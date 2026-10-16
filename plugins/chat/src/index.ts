import { randomUUID } from 'node:crypto';
import {
  badRequest,
  definePlugin,
  notFound,
  type ChatReply,
  type Fact,
  type FactDraft,
  type PersonId,
} from '@hdt/core';
import { GUEST_NAME, onboardingTopic } from './onboarding.js';

export interface ChatMessage {
  id: string;
  personId: PersonId;
  topic: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  awaiting?: string;
  factIds?: string[];
  flags?: string[];
  actions?: ChatReply['actions'];
}

export interface SendResult {
  message: ChatMessage;
  reply?: ChatMessage;
  /** Facts proposed from this message; the client shows them as "saved" cards to confirm or edit. */
  proposed: Fact[];
}

export interface ChatService {
  send(input: { personId: PersonId; topic: string; text: string; awaiting?: string }): Promise<SendResult>;
  history(personId: PersonId, topic: string): Promise<ChatMessage[]>;
  topics(): Array<{ id: string; title: string; description?: string }>;
}

declare module '@hdt/core' {
  interface ServiceMap {
    chat: ChatService;
  }
  interface EventMap {
    'chat.message': { message: ChatMessage };
  }
}

export default definePlugin({
  manifest: {
    id: 'chat',
    name: 'Chat',
    version: '0.1.0',
    description: 'Topic conversations with auto-collect.',
    dependsOn: ['profile'],
  },

  setup(ctx) {
    const profile = ctx.services.use('profile');
    ctx.extensions.contribute('chat.topic', onboardingTopic(ctx.store, profile));

    const save = async (m: ChatMessage) => {
      await ctx.store.set(`msg:${m.personId}:${m.topic}:${m.at}:${m.id}`, m);
      await ctx.events.emit('chat.message', { message: m });
      return m;
    };

    const topicById = (id: string) => ctx.extensions.all('chat.topic').find((t) => t.id === id);

    const service: ChatService = {
      topics: () => ctx.extensions.all('chat.topic').map(({ id, title, description }) => ({ id, title, description })),

      async send({ personId, topic, text, awaiting }) {
        if (!text?.trim()) throw badRequest('text is required');
        const t = topicById(topic);
        if (!t) throw notFound(`Chat topic '${topic}'`);
        await profile.require(personId);

        const message = await save({
          id: randomUUID(), personId, topic, role: 'user', text: text.trim(), at: new Date().toISOString(), awaiting,
        });

        // Every enabled plugin gets a chance to read facts from the message.
        const drafts: FactDraft[] = [];
        for (const ex of ctx.extensions.all('chat.extractor')) {
          if (ex.topics && !ex.topics.includes(topic)) continue;
          try {
            drafts.push(...(await ex.extract({ personId, topic, text: message.text, awaiting })));
          } catch (err) {
            ctx.log.error(`extractor ${ex.id} failed`, err);
          }
        }
        const proposed = drafts.length ? await ctx.facts.propose(drafts) : [];

        const r = await t.respond({ personId, topic, text: message.text, awaiting, proposed });
        const reply = r.text
          ? await save({
              id: randomUUID(), personId, topic, role: 'assistant', text: r.text, at: new Date().toISOString(),
              awaiting: r.awaiting, factIds: proposed.map((f) => f.id), flags: r.flags, actions: r.actions,
            })
          : undefined;
        return { message, reply, proposed };
      },

      history: (personId, topic) => ctx.store.list<ChatMessage>(`msg:${personId}:${topic}:`),
    };
    ctx.services.provide('chat', service);

    ctx.routes.add({ method: 'GET', path: '/topics', summary: 'Topics contributed by enabled plugins', handler: () => service.topics() });

    ctx.routes.add({
      method: 'POST', path: '/start', summary: 'Start chat onboarding for a new guest',
      handler: async (r) => {
        const person = r.body?.personId ? await profile.require(r.body.personId) : await profile.create({ fullName: GUEST_NAME });
        const topic = topicById('onboarding')!;
        const first = await topic.respond({ personId: person.id, topic: 'onboarding', text: '', proposed: [] });
        const reply = await save({
          id: randomUUID(), personId: person.id, topic: 'onboarding', role: 'assistant', text: first.text,
          at: new Date().toISOString(), awaiting: first.awaiting,
        });
        return { personId: person.id, reply };
      },
    });

    ctx.routes.add({
      method: 'POST', path: '/messages', summary: 'Send a message: { personId, topic, text, awaiting? }',
      handler: (r) => service.send(r.body ?? {}),
    });
    ctx.routes.add({ method: 'GET', path: '/messages/:personId/:topic', handler: (r) => service.history(r.params.personId, r.params.topic) });

    ctx.routes.add({
      method: 'POST', path: '/facts/:id/confirm', summary: 'Confirm a proposed fact, optionally with an edited value',
      handler: (r) => ctx.facts.confirm(r.params.id, r.body?.value),
    });
    ctx.routes.add({ method: 'POST', path: '/facts/:id/reject', handler: (r) => ctx.facts.reject(r.params.id) });
  },
});
