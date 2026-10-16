import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import profile from '@hdt/plugin-profile';
import tuvi from '@hdt/plugin-tuvi';
import { buildServer } from './server.js';

let app: FastifyInstance;
const call = async (method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => {
  const res = await app.inject({ method, url, payload: payload as any });
  return { status: res.statusCode, body: res.json() as any };
};

beforeAll(async () => {
  ({ app } = await buildServer({ logger: false }));
});
afterAll(() => app.close());

describe('chat onboarding → facts → plugins (end to end)', () => {
  let personId = '';
  let awaiting: string | undefined;

  const say = async (text: string, topic = 'onboarding') => {
    const r = await call('POST', '/api/chat/messages', { personId, topic, text, awaiting: topic === 'onboarding' ? awaiting : undefined });
    expect(r.status).toBe(200);
    if (topic === 'onboarding') awaiting = r.body.reply?.awaiting;
    return r.body;
  };
  const confirmAll = async (facts: Array<{ id: string }>) => {
    for (const f of facts) expect((await call('POST', `/api/chat/facts/${f.id}/confirm`)).status).toBe(200);
  };

  it('starts a guest conversation', async () => {
    const r = await call('POST', '/api/chat/start', {});
    personId = r.body.personId;
    awaiting = r.body.reply.awaiting;
    expect(awaiting).toBe('person.fullName');
  });

  it('collects birth details and builds the Tử vi chart', async () => {
    let r = await say('Nguyễn Minh An');
    expect(r.proposed.map((f: any) => f.kind)).toEqual(['person.fullName']);
    await confirmAll(r.proposed);
    expect(awaiting).toBe('person.birthDate');

    r = await say('12/05/1990');
    expect(r.proposed[0].value).toBe('1990-05-12');
    await confirmAll(r.proposed);

    r = await say('khoảng 11h trưa');
    expect(r.proposed[0]).toMatchObject({ kind: 'person.birthHour', value: 11 });
    await confirmAll(r.proposed);

    r = await say('Nam');
    await confirmAll(r.proposed);
    expect(awaiting).toBe('body.free');

    const chart = await call('GET', `/api/tuvi/charts/${personId}`);
    expect(chart.status).toBe(200);
    expect(chart.body).toMatchObject({ complete: true, yearCanChi: 'Canh Ngọ', hourBranch: 'Ngọ' });
  });

  it('retries when an answer cannot be read', async () => {
    const tmp = await call('POST', '/api/chat/start', {});
    const r = await call('POST', '/api/chat/messages', { personId: tmp.body.personId, topic: 'onboarding', text: 'hello', awaiting: 'person.birthDate' });
    expect(r.body.proposed).toEqual([]);
    expect(r.body.reply.awaiting).toBe('person.birthDate');
  });

  it('health facts need consent before they are saved', async () => {
    const r = await say('My stomach hurts after dinner, 7/10');
    const fact = r.proposed.find((f: any) => f.kind === 'body.observation');
    expect(fact.value.regionId).toBe('stomach');

    expect((await call('POST', `/api/chat/facts/${fact.id}/confirm`)).status).toBe(403);
    await call('PUT', `/api/profile/persons/${personId}/consents/health`, { granted: true });
    expect((await call('POST', `/api/chat/facts/${fact.id}/confirm`)).status).toBe(200);

    const status = await call('GET', `/api/body/status/${personId}`);
    expect(status.body.regions.find((x: any) => x.regionId === 'stomach')).toMatchObject({ status: 'watch' });
  });

  it('adds relatives from chat and learns their details', async () => {
    await call('PUT', `/api/profile/persons/${personId}/consents/family`, { granted: true });
    let r = await say('I live with my father, mother and my wife');
    expect(r.proposed.map((f: any) => f.value.role).sort()).toEqual(['father', 'mother', 'wife']);
    await confirmAll(r.proposed);
    expect(r.reply.text).toMatch(/everything I need/);

    r = await say('Mẹ sinh giờ Thìn', 'family');
    const hourFact = r.proposed.find((f: any) => f.kind === 'person.birthHour');
    expect(hourFact.value).toBe(8);
    expect(hourFact.subjectId).not.toBe(personId);
    await confirmAll([hourFact]);

    const rel = await call('GET', `/api/family/relatives/${personId}`);
    const mother = rel.body.find((x: any) => x.role === 'mother');
    expect(mother.person.birth.hour).toBe(8);
    expect(mother.person.shadow).toBe(true);
  });

  it('answers Tử vi questions from the chart', async () => {
    const r = await say('What does my career look like this year?', 'tuvi');
    expect(r.reply.text).toMatch(/Quan Lộc/);
    expect(r.reply.flags).toContain('reflection-only');
  });

  it('sends red-flag symptoms to urgent care instead of logging them', async () => {
    const r = await say('Tôi bị đau ngực và khó thở', 'body');
    expect(r.reply.flags).toContain('urgent-care');
    expect(r.reply.text).toMatch(/115/);
  });

  it('lists topics contributed by plugins', async () => {
    const r = await call('GET', '/api/chat/topics');
    expect(r.body.map((t: any) => t.id).sort()).toEqual(['body', 'family', 'onboarding', 'tuvi']);
  });
});

describe('plugins can be switched on and off', () => {
  it('runs with only profile + tuvi', async () => {
    const { app: small } = await buildServer({ logger: false, plugins: [profile, tuvi] });
    const routes = (await small.inject({ method: 'GET', url: '/api/_system/routes' })).json() as any[];
    expect(routes.some((r) => r.plugin === 'chat')).toBe(false);
    expect(routes.some((r) => r.path === '/api/tuvi/compute')).toBe(true);
    await small.close();
  });

  it('refuses to boot a plugin whose dependency is off', async () => {
    await expect(buildServer({ logger: false, plugins: [tuvi] })).rejects.toThrow(/depends on 'profile'/);
  });
});
