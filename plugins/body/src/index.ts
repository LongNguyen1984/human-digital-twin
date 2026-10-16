import { randomUUID } from 'node:crypto';
import { badRequest, definePlugin, unprocessable, type ChatReply, type FactDraft, type PersonId } from '@hdt/core';
import { REGIONS, regionById, regionsInText, redFlag, severityFrom, type Region } from './regions.js';

export * from './regions.js';

export interface Observation {
  id: string;
  personId: PersonId;
  regionId: string;
  kind: 'symptom' | 'measurement';
  label: string;
  /** 0–10 for symptoms. */
  severity?: number;
  value?: number;
  unit?: string;
  /** For measurements: was it outside the person's normal range? */
  flag?: 'normal' | 'high' | 'low';
  at: string;
  source: string;
}

export type RegionStatus = 'good' | 'watch' | 'attention';

export interface RegionState {
  regionId: string;
  label: Region['label'];
  meshes: string[];
  score: number;
  status: RegionStatus;
  recent: number;
}

export interface BodyService {
  regions(): Region[];
  observations(personId: PersonId, sinceDays?: number): Promise<Observation[]>;
  status(personId: PersonId): Promise<{ overall: number; regions: RegionState[] }>;
}

declare module '@hdt/core' {
  interface ServiceMap {
    body: BodyService;
  }
  interface EventMap {
    'body.observationAdded': { observation: Observation };
  }
}

const WINDOW_DAYS = 14;

export function scoreRegion(obs: Observation[]): { score: number; status: RegionStatus } {
  let score = 100;
  for (const o of obs) {
    if (o.kind === 'symptom') score -= (o.severity ?? 4) * 4;
    if (o.kind === 'measurement' && o.flag && o.flag !== 'normal') score -= 20;
  }
  score = Math.max(0, score);
  return { score, status: score >= 80 ? 'good' : score >= 50 ? 'watch' : 'attention' };
}

function validateObservation(v: any): Omit<Observation, 'id' | 'personId' | 'source'> {
  if (!v || typeof v !== 'object') throw unprocessable('Observation must be an object');
  if (!regionById(v.regionId)) throw unprocessable(`Unknown region '${v.regionId}'`);
  if (v.kind !== 'symptom' && v.kind !== 'measurement') throw unprocessable('kind must be symptom or measurement');
  if (v.severity !== undefined && (typeof v.severity !== 'number' || v.severity < 0 || v.severity > 10)) throw unprocessable('severity is 0–10');
  return {
    regionId: v.regionId,
    kind: v.kind,
    label: String(v.label ?? '').slice(0, 200) || regionById(v.regionId)!.label.en,
    severity: v.severity,
    value: v.value,
    unit: v.unit,
    flag: v.flag,
    at: v.at ?? new Date().toISOString(),
  };
}

export default definePlugin({
  manifest: {
    id: 'body',
    name: 'Body twin',
    version: '0.1.0',
    description: 'Regions, observations and status for the 3D body.',
    dependsOn: ['profile'],
  },

  setup(ctx) {
    const profile = ctx.services.use('profile');

    const service: BodyService = {
      regions: () => REGIONS,
      async observations(personId, sinceDays) {
        const all = await ctx.store.list<Observation>(`obs:${personId}:`);
        if (!sinceDays) return all;
        const since = Date.now() - sinceDays * 86_400_000;
        return all.filter((o) => Date.parse(o.at) >= since);
      },
      async status(personId) {
        const recent = await service.observations(personId, WINDOW_DAYS);
        const regions = REGIONS.map((r) => {
          const mine = recent.filter((o) => o.regionId === r.id);
          return { regionId: r.id, label: r.label, meshes: r.meshes, recent: mine.length, ...scoreRegion(mine) };
        });
        const overall = Math.round(regions.reduce((s, r) => s + r.score, 0) / regions.length);
        return { overall, regions };
      },
    };
    ctx.services.provide('body', service);

    ctx.facts.handle({
      kind: 'body.observation',
      requiresConsent: 'health',
      validate: validateObservation,
      async apply(fact) {
        const v = fact.value as ReturnType<typeof validateObservation>;
        const observation: Observation = { ...v, id: randomUUID(), personId: fact.subjectId, source: fact.source.type };
        await ctx.store.set(`obs:${fact.subjectId}:${observation.at}:${observation.id}`, observation);
        await ctx.events.emit('body.observationAdded', { observation });
      },
    });

    // Symptoms mentioned in chat become proposed observations. Never from community rooms.
    ctx.extensions.contribute('chat.extractor', {
      id: 'body.symptoms',
      topics: ['body', 'onboarding'],
      extract({ personId, text, topic, awaiting }) {
        if (awaiting?.startsWith('person.')) return [];
        const regions = regionsInText(text);
        const severity = severityFrom(text);
        return regions.map<FactDraft>((r) => ({
          kind: 'body.observation',
          personId,
          value: { regionId: r.id, kind: 'symptom', label: text.trim().slice(0, 200), severity },
          summary: `${r.label.en}: ${text.trim().slice(0, 60)}`,
          confidence: 0.8,
          source: { type: 'chat', topic },
        }));
      },
    });

    ctx.extensions.contribute('chat.topic', {
      id: 'body',
      title: 'Body health',
      description: 'Symptoms, habits and check-ups.',
      async respond({ personId, text, proposed }): Promise<ChatReply> {
        const flag = redFlag(text);
        if (flag) {
          return {
            text: 'This could be serious. Please get medical help now: call 115 or go to the nearest emergency department. I’m not able to assess this in chat.',
            flags: ['urgent-care'],
          };
        }
        const logged = proposed.filter((f) => f.kind === 'body.observation');
        if (logged.length) {
          const hasConsent = await ctx.consent.has(personId, 'health');
          const names = logged.map((f) => regionById((f.value as any).regionId)!.label.en.toLowerCase()).join(' and ');
          return {
            text: hasConsent
              ? `I can add this to your ${names} history. Tap confirm to save it. Anything that made it better or worse?`
              : `I can track your ${names} for you, but health data is off. Turn on health data in privacy settings, then confirm to save.`,
          };
        }
        if (/(week|status|tuan|tinh trang|how am i)/i.test(text)) {
          const s = await service.status(personId);
          const watch = s.regions.filter((r) => r.status !== 'good').map((r) => r.label.en.toLowerCase());
          return { text: `Overall ${s.overall}/100.${watch.length ? ` Keep an eye on: ${watch.join(', ')}.` : ' Nothing to watch right now.'}` };
        }
        await profile.require(personId);
        return { text: 'Thanks for telling me. Which part of your body is this about?' };
      },
    });

    ctx.routes.add({ method: 'GET', path: '/regions', handler: () => REGIONS });
    ctx.routes.add({ method: 'GET', path: '/status/:personId', handler: (r) => service.status(r.params.personId) });
    ctx.routes.add({
      method: 'GET', path: '/observations/:personId',
      handler: (r) => service.observations(r.params.personId, r.query.days ? Number(r.query.days) : undefined),
    });
    ctx.routes.add({
      method: 'POST', path: '/observations', summary: 'Add an observation from a form or device (saved immediately)',
      handler: async (r) => {
        const { personId, source = 'form', ...value } = r.body ?? {};
        if (!personId) throw badRequest('personId is required');
        await profile.require(personId);
        const [fact] = await ctx.facts.propose([
          { kind: 'body.observation', personId, value, summary: value.label ?? value.regionId, confidence: 1, source: { type: source } },
        ]);
        return ctx.facts.confirm(fact.id);
      },
    });
  },
});
