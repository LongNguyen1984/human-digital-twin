/**
 * Storage port. Each plugin receives a namespace so it can only see its own
 * keys. Production adapters (PostgreSQL, TimescaleDB, Neo4j, a vector DB) can
 * implement richer ports per plugin; this key-value port is enough to build
 * and test every plugin first.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** Values whose key starts with prefix, in key order. */
  list<T>(prefix: string): Promise<T[]>;
}

export interface StoreDriver {
  namespace(ns: string): KeyValueStore;
}

export class InMemoryStoreDriver implements StoreDriver {
  private data = new Map<string, unknown>();

  namespace(ns: string): KeyValueStore {
    const k = (key: string) => `${ns}::${key}`;
    const data = this.data;
    return {
      async get<T>(key: string) {
        const v = data.get(k(key));
        return v === undefined ? undefined : (structuredClone(v) as T);
      },
      async set<T>(key: string, value: T) {
        data.set(k(key), structuredClone(value));
      },
      async delete(key: string) {
        data.delete(k(key));
      },
      async list<T>(prefix: string) {
        const full = k(prefix);
        return [...data.keys()]
          .filter((key) => key.startsWith(full))
          .sort()
          .map((key) => structuredClone(data.get(key)) as T);
      },
    };
  }
}
