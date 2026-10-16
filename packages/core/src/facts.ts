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

  constructor(
    private store: KeyValueStore,
    private events: EventBus,
    private consent: ConsentService,
    private policy: FactPolicy = { autoConfirmAt: null, minConfidence: 0.5 },
  ) {}

  registerHandler(owner: string, handler: FactHandler): void {
    const existing = this.handlers.get(handler.kind);
    if (existing) throw new Error(`Fact kind '${handler.kind}' already owned by '${existing.owner}'`);
    this.handlers.set(handler.kind, { ...handler, owner });
  }

  kinds(): string[] {
    return [...this.handlers.keys()].sort();
  }

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

  async get(id: string): Promise<Fact> {
    const key = await this.store.get<string>(`id:${id}`);
    const fact = key ? await this.store.get<Fact>(key) : undefined;
    if (!fact) throw notFound(`Fact ${id}`);
    return fact;
  }

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

  async reject(id: string): Promise<Fact> {
    const fact = await this.get(id);
    if (fact.status !== 'proposed') throw unprocessable(`Fact ${id} is already ${fact.status}`);
    fact.status = 'rejected';
    fact.decidedAt = new Date().toISOString();
    await this.store.set(this.key(fact), fact);
    await this.events.emit('fact.rejected', { fact });
    return fact;
  }

  async list(personId: PersonId, status?: Fact['status']): Promise<Fact[]> {
    const all = await this.store.list<Fact>(`person:${personId}:`);
    return status ? all.filter((f) => f.status === status) : all;
  }

  private key(f: Fact) {
    return `person:${f.personId}:${f.createdAt}:${f.id}`;
  }
}
