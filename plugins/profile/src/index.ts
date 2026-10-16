import { randomUUID } from 'node:crypto';
import {
  badRequest,
  definePlugin,
  fold,
  notFound,
  unprocessable,
  type ConsentScope,
  type FactDraft,
  type Gender,
  type Person,
  type PersonId,
} from '@hdt/core';
import { parseDate, parseGender, parseHour } from './parse.js';

export { parseDate, parseGender, parseHour } from './parse.js';

export interface CreatePersonInput {
  fullName: string;
  gender?: Gender;
  birth?: Person['birth'];
  shadow?: boolean;
  createdBy?: PersonId;
}

export interface ProfileService {
  create(input: CreatePersonInput): Promise<Person>;
  get(id: PersonId): Promise<Person | undefined>;
  require(id: PersonId): Promise<Person>;
  update(id: PersonId, patch: Partial<Pick<Person, 'fullName' | 'gender' | 'birth'>>): Promise<Person>;
  list(): Promise<Person[]>;
}

declare module '@hdt/core' {
  interface ServiceMap {
    profile: ProfileService;
  }
}

const CONSENT_SCOPES: ConsentScope[] = ['health', 'family', 'community.visible', 'matching'];

export default definePlugin({
  manifest: {
    id: 'profile',
    name: 'Profile',
    version: '0.1.0',
    description: 'People, birth details and consent.',
  },

  setup(ctx) {
    const key = (id: string) => `person:${id}`;

    const service: ProfileService = {
      async create(input) {
        if (!input.fullName?.trim()) throw badRequest('fullName is required');
        const now = new Date().toISOString();
        const person: Person = {
          id: randomUUID(),
          fullName: input.fullName.trim(),
          gender: input.gender,
          birth: { timeZone: 7, ...(input.birth ?? {}) },
          shadow: input.shadow ?? false,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        };
        await ctx.store.set(key(person.id), person);
        await ctx.events.emit('person.created', { person });
        return person;
      },
      async get(id) {
        return ctx.store.get<Person>(key(id));
      },
      async require(id) {
        const p = await ctx.store.get<Person>(key(id));
        if (!p) throw notFound(`Person ${id}`);
        return p;
      },
      async update(id, patch) {
        const cur = await service.require(id);
        const next: Person = {
          ...cur,
          ...('fullName' in patch && patch.fullName ? { fullName: patch.fullName } : {}),
          ...('gender' in patch ? { gender: patch.gender } : {}),
          birth: { ...cur.birth, ...(patch.birth ?? {}) },
          updatedAt: new Date().toISOString(),
        };
        const changed: string[] = [];
        if (next.fullName !== cur.fullName) changed.push('fullName');
        if (next.gender !== cur.gender) changed.push('gender');
        for (const k of ['date', 'hour', 'place', 'timeZone'] as const) {
          if (next.birth[k] !== cur.birth[k]) changed.push(`birth.${k}`);
        }
        await ctx.store.set(key(id), next);
        if (changed.length) await ctx.events.emit('person.updated', { person: next, changed });
        return next;
      },
      async list() {
        return ctx.store.list<Person>('person:');
      },
    };
    ctx.services.provide('profile', service);

    // ---- Fact handlers: the only way chat/import data reaches a profile ----
    ctx.facts.handle({
      kind: 'person.fullName',
      validate: (v) => {
        if (typeof v !== 'string' || v.trim().length < 2) throw unprocessable('Name is too short');
        return v.trim();
      },
      apply: (f) => service.update(f.subjectId, { fullName: f.value as string }).then(() => {}),
    });
    ctx.facts.handle({
      kind: 'person.birthDate',
      validate: (v) => {
        const d = typeof v === 'string' ? parseDate(v) : undefined;
        if (!d) throw unprocessable('Birth date must be a real date, e.g. 1990-05-12');
        return d;
      },
      apply: (f) => service.update(f.subjectId, { birth: { date: f.value as string } }).then(() => {}),
    });
    ctx.facts.handle({
      kind: 'person.birthHour',
      validate: (v) => {
        if (v === null) return null;
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 23) throw unprocessable('Hour must be 0–23 or null');
        return v;
      },
      apply: (f) => service.update(f.subjectId, { birth: { hour: f.value as number | null } }).then(() => {}),
    });
    ctx.facts.handle({
      kind: 'person.gender',
      validate: (v) => {
        if (v !== 'male' && v !== 'female') throw unprocessable('Gender must be male or female');
        return v;
      },
      apply: (f) => service.update(f.subjectId, { gender: f.value as Gender }).then(() => {}),
    });

    // ---- Chat extractor: reads short answers when the assistant asked for them ----
    ctx.extensions.contribute('chat.extractor', {
      id: 'profile.basics',
      extract({ personId, text, awaiting, topic }) {
        const out: FactDraft[] = [];
        const source = { type: 'chat' as const, topic };
        const f = fold(text);
        const aboutSelf = !/\b(bo|me|cha|vo|chong|con|ong|ba|anh|chi|em|father|mother|wife|husband|son|daughter)\b/.test(f);

        if (awaiting === 'person.fullName') {
          const name = text.trim();
          if (name.length >= 2 && name.length <= 80 && !/\d/.test(name)) {
            out.push({ kind: 'person.fullName', personId, value: name, summary: name, confidence: 0.9, source });
          }
        }
        const date = parseDate(text);
        if (date && (awaiting === 'person.birthDate' || (aboutSelf && /(sinh|born|birth)/.test(f)))) {
          out.push({
            kind: 'person.birthDate', personId, value: date, summary: date,
            confidence: awaiting === 'person.birthDate' ? 0.9 : 0.7, source,
          });
        }
        if (awaiting === 'person.birthHour') {
          const h = parseHour(text);
          if (h) {
            out.push({
              kind: 'person.birthHour', personId, value: h.hour,
              summary: h.hour === null ? 'Unknown, can add later' : `${String(h.hour).padStart(2, '0')}:00`,
              confidence: 0.9, source,
            });
          }
        }
        if (awaiting === 'person.gender') {
          const g = parseGender(text);
          if (g) out.push({ kind: 'person.gender', personId, value: g, summary: g === 'male' ? 'Nam' : 'Nữ', confidence: 0.9, source });
        }
        return out;
      },
    });

    // ---- Routes (mounted at /api/profile) ----
    ctx.routes.add({ method: 'POST', path: '/persons', summary: 'Create a person', handler: (r) => service.create(r.body ?? {}) });
    ctx.routes.add({ method: 'GET', path: '/persons', summary: 'List people', handler: () => service.list() });
    ctx.routes.add({ method: 'GET', path: '/persons/:id', handler: (r) => service.require(r.params.id) });
    ctx.routes.add({ method: 'PATCH', path: '/persons/:id', handler: (r) => service.update(r.params.id, r.body ?? {}) });
    ctx.routes.add({
      method: 'GET', path: '/persons/:id/facts', summary: 'Collected facts (proposed, confirmed, rejected)',
      handler: (r) => ctx.facts.list(r.params.id, r.query.status as any),
    });
    ctx.routes.add({ method: 'GET', path: '/persons/:id/consents', handler: (r) => ctx.consent.list(r.params.id) });
    ctx.routes.add({
      method: 'PUT', path: '/persons/:id/consents/:scope',
      handler: async (r) => {
        const scope = r.params.scope as ConsentScope;
        if (!CONSENT_SCOPES.includes(scope)) throw badRequest(`Unknown scope; use one of ${CONSENT_SCOPES.join(', ')}`);
        await service.require(r.params.id);
        await ctx.consent.set(r.params.id, scope, r.body?.granted === true);
        return ctx.consent.list(r.params.id);
      },
    });
  },
});
