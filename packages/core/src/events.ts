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

  /**
   * @param errorSink - Called when a handler throws, with the error, event name
   *   and handler owner. Defaults to logging via `console.error`.
   */
  constructor(errorSink?: (err: unknown, event: string, owner: string) => void) {
    this.errorSink = errorSink ?? ((err, event, owner) => console.error(`[events] ${owner} failed on ${event}`, err));
  }

  /**
   * Subscribe a handler to an event.
   * @param event - Event name from `EventMap`.
   * @param fn - Handler; may be async.
   * @param owner - Identifies the subscriber in error reports. Defaults to `'anonymous'`.
   * @returns A function that unsubscribes this handler.
   */
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

  /**
   * Deliver an event. Handlers are awaited sequentially, in registration order.
   * Handler errors are swallowed and routed to `errorSink`; they are never rethrown.
   * @param event - Event name from `EventMap`.
   * @param payload - Payload passed to every handler.
   * @returns Resolves once every handler has finished.
   */
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
