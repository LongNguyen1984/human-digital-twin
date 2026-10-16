import { definePlugin, type PersonId } from '@hdt/core';

/**
 * __NAME__ plugin.
 *
 * Checklist for a new plugin:
 *  1. Own your data: use ctx.store (namespaced to this plugin) or your own adapter.
 *  2. Offer a service if other plugins need you (declare it in ServiceMap below).
 *  3. Accept collected data only through facts: ctx.facts.handle({ kind: '__ID__.something', ... }).
 *  4. Optionally read facts from chat (chat.extractor) and answer a topic (chat.topic).
 *  5. Expose HTTP routes with ctx.routes.add; they mount at /api/__ID__.
 *  6. Add it to apps/api/src/plugins.config.ts and write tests next to the code.
 */

export interface __PASCAL__Service {
  ping(personId: PersonId): Promise<string>;
}

declare module '@hdt/core' {
  interface ServiceMap {
    '__ID__': __PASCAL__Service;
  }
  interface EventMap {
    '__ID__.updated': { personId: PersonId };
  }
}

export default definePlugin({
  manifest: {
    id: '__ID__',
    name: '__NAME__',
    version: '0.1.0',
    dependsOn: ['profile'],
  },

  setup(ctx) {
    const profile = ctx.services.use('profile');

    const service: __PASCAL__Service = {
      async ping(personId) {
        const p = await profile.require(personId);
        return `pong ${p.fullName}`;
      },
    };
    ctx.services.provide('__ID__', service);

    // ctx.facts.handle({ kind: '__ID__.something', requiresConsent: 'health', validate, apply });
    // ctx.extensions.contribute('chat.extractor', { id: '__ID__.reader', topics: ['__ID__'], extract });
    // ctx.extensions.contribute('chat.topic', { id: '__ID__', title: '__NAME__', respond });
    // ctx.events.on('person.updated', async ({ person }) => { ... });

    ctx.routes.add({ method: 'GET', path: '/ping/:personId', handler: (r) => service.ping(r.params.personId) });
  },
});
