import type { EventBus } from './events.js';
import type { KeyValueStore } from './store.js';
import type { ConsentScope, PersonId } from './types.js';

export class ConsentService {
  constructor(private store: KeyValueStore, private events: EventBus) {}

  async has(personId: PersonId, scope: ConsentScope): Promise<boolean> {
    return (await this.store.get<boolean>(`${personId}:${scope}`)) === true;
  }

  async set(personId: PersonId, scope: ConsentScope, granted: boolean): Promise<void> {
    await this.store.set(`${personId}:${scope}`, granted);
    await this.events.emit('consent.changed', { personId, scope, granted });
  }

  async list(personId: PersonId): Promise<Record<ConsentScope, boolean>> {
    const scopes: ConsentScope[] = ['health', 'family', 'community.visible', 'matching'];
    const out = {} as Record<ConsentScope, boolean>;
    for (const s of scopes) out[s] = await this.has(personId, s);
    return out;
  }
}
