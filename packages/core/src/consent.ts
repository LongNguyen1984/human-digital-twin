import type { EventBus } from './events.js';
import type { KeyValueStore } from './store.js';
import type { ConsentScope, PersonId } from './types.js';

/**
 * Per-person consent flags, stored under the kernel's `_consent` namespace;
 * emits `consent.changed`.
 */
export class ConsentService {
  /**
   * @param store - Store for the flags (keys are `<personId>:<scope>`).
   * @param events - Bus used to emit `consent.changed`.
   */
  constructor(private store: KeyValueStore, private events: EventBus) {}

  /**
   * Whether the person has explicitly granted a scope.
   * @param personId - Person whose consent is checked.
   * @param scope - Consent scope.
   * @returns `true` only if explicitly granted; a missing flag counts as not granted.
   */
  async has(personId: PersonId, scope: ConsentScope): Promise<boolean> {
    return (await this.store.get<boolean>(`${personId}:${scope}`)) === true;
  }

  /**
   * Persist a consent flag and emit `consent.changed`.
   * @param personId - Person whose consent changes.
   * @param scope - Consent scope.
   * @param granted - New value of the flag.
   */
  async set(personId: PersonId, scope: ConsentScope, granted: boolean): Promise<void> {
    await this.store.set(`${personId}:${scope}`, granted);
    await this.events.emit('consent.changed', { personId, scope, granted });
  }

  /**
   * Every known scope mapped to its current flag.
   * The scope list is hard-coded here; keep it in sync with `ConsentScope` in `types.ts`.
   * @param personId - Person whose consent flags are listed.
   * @returns A record with one boolean per `ConsentScope`.
   */
  async list(personId: PersonId): Promise<Record<ConsentScope, boolean>> {
    const scopes: ConsentScope[] = ['health', 'family', 'community.visible', 'matching'];
    const out = {} as Record<ConsentScope, boolean>;
    for (const s of scopes) out[s] = await this.has(personId, s);
    return out;
  }
}
