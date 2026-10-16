import type { EventMap } from './types.js';

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void | Promise<void>;

/**
 * In-process async event bus. `emit` awaits every handler so tests and
 * request flows are deterministic. Swap for Kafka/NATS later behind the same
 * interface: plugins only see `on` and `emit`.
 */
export class EventBus {
  private handlers = new Map<string, Array<{ owner: string; fn: Handler<any> }>>();
  private errorSink: (err: unknown, event: string, owner: string) => void;

  constructor(errorSink?: (err: unknown, event: string, owner: string) => void) {
    this.errorSink = errorSink ?? ((err, event, owner) => console.error(`[events] ${owner} failed on ${event}`, err));
  }

  on<K extends keyof EventMap>(event: K, fn: Handler<K>, owner = 'anonymous'): () => void {
    const list = this.handlers.get(event as string) ?? [];
    const entry = { owner, fn };
    list.push(entry);
    this.handlers.set(event as string, list);
    return () => {
      const cur = this.handlers.get(event as string) ?? [];
      this.handlers.set(event as string, cur.filter((h) => h !== entry));
    };
  }

  async emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void> {
    const list = this.handlers.get(event as string) ?? [];
    for (const { owner, fn } of list) {
      try {
        await fn(payload);
      } catch (err) {
        // One failing plugin must never break another plugin's flow.
        this.errorSink(err, event as string, owner);
      }
    }
  }
}
