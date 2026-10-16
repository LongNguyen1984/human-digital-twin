import {
  badRequest,
  definePlugin,
  fold,
  unprocessable,
  type ChatReply,
  type FactDraft,
  type Person,
  type PersonId,
} from '@hdt/core';
import { parseDate, parseHour } from '@hdt/plugin-profile';
import { INVERSE, roleDef, ROLES, rolesInText, type Relation, type Role } from './roles.js';

export * from './roles.js';

export interface Edge {
  from: PersonId;
  to: PersonId;
  relation: Relation;
  /** Role of `to` as seen from `from`, when known (e.g. 'mother'). */
  role?: Role;
}

export interface Relative {
  person: Person;
  relation: Relation;
  role?: Role;
  missing: string[];
}

export interface FamilyService {
  addRelative(personId: PersonId, role: Role, opts?: { name?: string; birth?: Person['birth'] }): Promise<Relative>;
  relatives(personId: PersonId): Promise<Relative[]>;
  findByRole(personId: PersonId, role: Role): Promise<Relative | undefined>;
}

declare module '@hdt/core' {
  interface ServiceMap {
    family: FamilyService;
  }
  interface EventMap {
    'family.relativeAdded': { personId: PersonId; relative: Relative };
  }
}

const missingOf = (p: Person) => [
  ...(p.birth.date ? [] : ['birth date']),
  ...(p.birth.hour === undefined ? ['birth hour'] : []),
];

export default definePlugin({
  manifest: {
    id: 'family',
    name: 'Family',
    version: '0.1.0',
    description: 'Relatives, relations and family facts.',
    dependsOn: ['profile'],
  },

  setup(ctx) {
    const profile = ctx.services.use('profile');

    const service: FamilyService = {
      async addRelative(personId, role, opts = {}) {
        const def = roleDef(role);
        if (!def) throw unprocessable(`Unknown role '${role}'`);
        await profile.require(personId);
        const existing = await service.findByRole(personId, role);
        if (existing && def.relation !== 'child' && def.relation !== 'sibling') return existing;
        const person = await profile.create({
          fullName: opts.name ?? def.label.vi,
          gender: def.gender,
          birth: opts.birth,
          shadow: true,
          createdBy: personId,
        });
        const edge: Edge = { from: personId, to: person.id, relation: def.relation, role };
        await ctx.store.set(`edge:${personId}:${person.id}`, edge);
        await ctx.store.set(`edge:${person.id}:${personId}`, { from: person.id, to: personId, relation: INVERSE[def.relation] });
        const relative: Relative = { person, relation: def.relation, role, missing: missingOf(person) };
        await ctx.events.emit('family.relativeAdded', { personId, relative });
        return relative;
      },
      async relatives(personId) {
        const edges = await ctx.store.list<Edge>(`edge:${personId}:`);
        const out: Relative[] = [];
        for (const e of edges) {
          const person = await profile.get(e.to);
          if (person) out.push({ person, relation: e.relation, role: e.role, missing: missingOf(person) });
        }
        return out;
      },
      async findByRole(personId, role) {
        return (await service.relatives(personId)).find((r) => r.role === role);
      },
    };
    ctx.services.provide('family', service);

    ctx.facts.handle({
      kind: 'family.relative',
      requiresConsent: 'family',
      validate: (v: any) => {
        if (!v || !roleDef(v.role)) throw unprocessable('value.role must be a known role');
        return { role: v.role as Role, name: typeof v.name === 'string' ? v.name : undefined };
      },
      apply: async (f) => {
        const v = f.value as { role: Role; name?: string };
        await service.addRelative(f.subjectId, v.role, { name: v.name });
      },
    });

    // Reads family members and their birth details from chat.
    ctx.extensions.contribute('chat.extractor', {
      id: 'family.mentions',
      topics: ['family', 'onboarding'],
      async extract({ personId, text, topic, awaiting }) {
        // A reply to "what's your name?" ("Nguyễn Văn Ba") is not about relatives.
        if (awaiting?.startsWith('person.')) return [];
        const out: FactDraft[] = [];
        const source = { type: 'chat' as const, topic };
        const roles = rolesInText(text);
        const known = await service.relatives(personId);
        const f = fold(text);

        for (const role of roles) {
          const existing = known.find((r) => r.role === role);
          if (!existing) {
            const def = roleDef(role)!;
            out.push({
              kind: 'family.relative', personId, value: { role }, summary: `${def.label.vi} (${def.label.en})`,
              confidence: 0.75, source,
            });
          }
        }

        // "Mẹ sinh giờ Thìn" / "my mother was born on 2/3/1965" → facts about that relative.
        if (roles.length === 1) {
          const rel = known.find((r) => r.role === roles[0]);
          if (rel && /(sinh|born|birth)/.test(f)) {
            const date = parseDate(text);
            if (date) {
              out.push({ kind: 'person.birthDate', personId, subjectId: rel.person.id, value: date, summary: `${rel.person.fullName} · ${date}`, confidence: 0.8, source });
            }
            const hour = parseHour(text.replace(/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, ''));
            if (hour && hour.hour !== null) {
              out.push({
                kind: 'person.birthHour', personId, subjectId: rel.person.id, value: hour.hour,
                summary: `${rel.person.fullName} · ${String(hour.hour).padStart(2, '0')}:00`, confidence: 0.8, source,
              });
            }
          }
        }
        return out;
      },
    });

    ctx.extensions.contribute('chat.topic', {
      id: 'family',
      title: 'Family',
      description: 'Your family group. Twin joins when you write @twin.',
      async respond({ personId, text, proposed }): Promise<ChatReply> {
        const newPeople = proposed.filter((p) => p.kind === 'family.relative');
        const aboutRelatives = proposed.filter((p) => p.subjectId !== personId);
        if (newPeople.length) {
          return { text: `Want me to add ${newPeople.map((p) => p.summary).join(', ')} to your family tree? Confirm to save.` };
        }
        if (aboutRelatives.length) {
          return { text: `Save ${aboutRelatives.map((p) => p.summary).join(' and ')} to their profile? Confirm to save.` };
        }
        if (!/@twin/i.test(text)) return { text: '' }; // Plain family chat: the assistant stays quiet.
        const rel = await service.relatives(personId);
        const gaps = rel.filter((r) => r.missing.length).map((r) => `${r.person.fullName} (${r.missing.join(', ')})`);
        return {
          text: rel.length
            ? `Your family: ${rel.map((r) => r.person.fullName).join(', ')}.${gaps.length ? ` Still missing: ${gaps.join('; ')}.` : ' Everyone’s details are complete.'}`
            : 'You haven’t added anyone yet. Who is in your family?',
        };
      },
    });

    ctx.routes.add({ method: 'GET', path: '/roles', handler: () => ROLES.map(({ role, relation, label }) => ({ role, relation, label })) });
    ctx.routes.add({ method: 'GET', path: '/relatives/:personId', handler: (r) => service.relatives(r.params.personId) });
    ctx.routes.add({
      method: 'POST', path: '/relatives', summary: 'Add a relative from a form (requires family consent)',
      handler: async (r) => {
        const { personId, role, name } = r.body ?? {};
        if (!personId || !role) throw badRequest('personId and role are required');
        const [fact] = await ctx.facts.propose([
          { kind: 'family.relative', personId, value: { role, name }, summary: name ?? role, confidence: 1, source: { type: 'form' } },
        ]);
        await ctx.facts.confirm(fact.id);
        return service.findByRole(personId, role);
      },
    });
  },
});
