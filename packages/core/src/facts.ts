import { randomUUID } from 'node:crypto';
import type { ConsentService } from './consent.js';
import { badRequest, forbidden, notFound, unprocessable } from './errors.js';
import type { EventBus } from './events.js';
import type { KeyValueStore } from './store.js';
import type { Fact, FactDraft, FactHandler, PersonId } from './types.js';

export interface FactPolicy {
  /** Facts at or above this confidence are confirmed without asking. null = always ask. */
  autoConfirmAt: number | null;
  /** Drafts below this confidence are dropped; the assistant should ask instead. */
  minConfidence: number;
}

/**
 * Facts pipeline: every collected datum (chat, import, form, device) becomes
 * a proposed Fact, is confirmed by the person (or policy), checked against
 * consent, and only then applied by the plugin that owns its kind.
 */
export class FactService {
  private handlers = new Map<string, FactHandler & { owner: string }>();

  /**
   * @param store - Store for facts (the kernel passes its `_facts` namespace).
   * @param events - Bus used to emit `fact.proposed`, `fact.confirmed` and `fact.rejected`.
   * @param consent - Checked before applying facts whose handler requires consent.
   * @param policy - Confirmation policy. Defaults to `{ autoConfirmAt: null, minConfidence: 0.5 }`.
   */
  constructor(
    private store: KeyValueStore,
    private events: EventBus,
    private consent: ConsentService,
    private policy: FactPolicy = { autoConfirmAt: null, minConfidence: 0.5 },
  ) {}

  /**
   * Register the handler that owns a fact kind.
   * @param owner - Id of the plugin registering the handler.
   * @param handler - Handler for `handler.kind`.
   * @throws Error if the kind already has an owner.
   */
  registerHandler(owner: string, handler: FactHandler): void {
    const existing = this.handlers.get(handler.kind);
    if (existing) throw new Error(`Fact kind '${handler.kind}' already owned by '${existing.owner}'`);
    this.handlers.set(handler.kind, { ...handler, owner });
  }

  /** @returns The registered fact kinds, sorted. */
  kinds(): string[] {
    return [...this.handlers.keys()].sort();
  }

  /**
   * Turn drafts into proposed facts.
   *
   * Drafts below `policy.minConfidence` are silently dropped. The handler's
   * `validate` runs here, each stored fact emits `fact.proposed`, and facts at or
   * above `policy.autoConfirmAt` are confirmed immediately (see {@link confirm}).
   * @param drafts - Fact drafts to propose.
   * @returns The stored facts (proposed, or confirmed when auto-confirmed), in input order.
   * @throws {HttpError} 400 when no plugin handles a draft's kind.
   * @throws Any error from the handler's `validate` (typically a 422 `HttpError`),
   *   or from {@link confirm} when auto-confirming.
   */
  async propose(drafts: FactDraft[]): Promise<Fact[]> {
    const out: Fact[] = [];
    for (const d of drafts) {
      if (d.confidence < this.policy.minConfidence) continue;
      const handler = this.handlers.get(d.kind);
      if (!handler) throw badRequest(`No plugin handles fact kind '${d.kind}'`);
      const value = handler.validate ? handler.validate(d.value) : d.value;
      const fact: Fact = {
        ...d,
        value,
        subjectId: d.subjectId ?? d.personId,
        id: randomUUID(),
        status: 'proposed',
        createdAt: new Date().toISOString(),
      };
      await this.store.set(this.key(fact), fact);
      await this.store.set(`id:${fact.id}`, this.key(fact));
      await this.events.emit('fact.proposed', { fact });
      if (this.policy.autoConfirmAt !== null && fact.confidence >= this.policy.autoConfirmAt) {
        out.push(await this.confirm(fact.id));
      } else {
        out.push(fact);
      }
    }
    return out;
  }

  /**
   * @param id - Fact id.
   * @returns The fact with that id.
   * @throws {HttpError} 404 when the fact does not exist.
   */
  async get(id: string): Promise<Fact> {
    const key = await this.store.get<string>(`id:${id}`);
    const fact = key ? await this.store.get<Fact>(key) : undefined;
    if (!fact) throw notFound(`Fact ${id}`);
    return fact;
  }

  /**
   * Confirm a proposed fact: check consent, apply it through its handler, then
   * mark it confirmed and emit `fact.confirmed`.
   * @param id - Fact id.
   * @param overrideValue - Optional corrected value; validated by the handler if it has `validate`.
   * @returns The confirmed fact.
   * @throws {HttpError} 404 when the fact does not exist.
   * @throws {HttpError} 422 when the fact is not `proposed`.
   * @throws {HttpError} 403 when the handler requires a consent the subject has not granted.
   */
  async confirm(id: string, overrideValue?: unknown): Promise<Fact> {
    const fact = await this.get(id);
    if (fact.status !== 'proposed') throw unprocessable(`Fact ${id} is already ${fact.status}`);
    const handler = this.handlers.get(fact.kind)!;
    if (handler.requiresConsent && !(await this.consent.has(fact.subjectId, handler.requiresConsent))) {
      throw forbidden(`Consent '${handler.requiresConsent}' is required before saving ${fact.kind}`);
    }
    if (overrideValue !== undefined) {
      fact.value = handler.validate ? handler.validate(overrideValue) : overrideValue;
    }
    await handler.apply(fact);
    fact.status = 'confirmed';
    fact.decidedAt = new Date().toISOString();
    await this.store.set(this.key(fact), fact);
    await this.events.emit('fact.confirmed', { fact });
    return fact;
  }

  /**
   * Reject a proposed fact and emit `fact.rejected`.
   * @param id - Fact id.
   * @returns The rejected fact.
   * @throws {HttpError} 404 when the fact does not exist.
   * @throws {HttpError} 422 when the fact is not `proposed`.
   */
  async reject(id: string): Promise<Fact> {
    const fact = await this.get(id);
    if (fact.status !== 'proposed') throw unprocessable(`Fact ${id} is already ${fact.status}`);
    fact.status = 'rejected';
    fact.decidedAt = new Date().toISOString();
    await this.store.set(this.key(fact), fact);
    await this.events.emit('fact.rejected', { fact });
    return fact;
  }

  /**
   * Facts reported by a person (not facts whose subject is that person).
   * @param personId - Reporter (`Fact.personId`).
   * @param status - Optional status filter.
   * @returns Matching facts, ordered by `createdAt`.
   */
  async list(personId: PersonId, status?: Fact['status']): Promise<Fact[]> {
    const all = await this.store.list<Fact>(`person:${personId}:`);
    return status ? all.filter((f) => f.status === status) : all;
  }

  private key(f: Fact): string {
    return `person:${f.personId}:${f.createdAt}:${f.id}`;
  }
}
