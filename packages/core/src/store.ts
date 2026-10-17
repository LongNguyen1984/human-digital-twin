/**
 * Storage port. Each plugin receives a namespace so it can only see its own
 * keys. Production adapters (PostgreSQL, TimescaleDB, Neo4j, a vector DB) can
 * implement richer ports per plugin; this key-value port is enough to build
 * and test every plugin first.
 */
export interface KeyValueStore {
  /** Structured clone of the value stored at key, or `undefined` if absent. */
  get<T>(key: string): Promise<T | undefined>;
  /** Stores a structured clone of value at key, replacing any existing value. */
  set<T>(key: string, value: T): Promise<void>;
  /** Removes key; a no-op if it does not exist. */
  delete(key: string): Promise<void>;
  /** Values whose key starts with prefix, in key order. */
  list<T>(prefix: string): Promise<T[]>;
}

/** Factory for namespaced stores. */
export interface StoreDriver {
  /** Returns a store whose keys are isolated under `ns`. */
  namespace(ns: string): KeyValueStore;
}

/**
 * Non-persistent driver for dev and tests; data is lost on restart.
 * Values are deep-copied with `structuredClone` on read and write.
 */
export class InMemoryStoreDriver implements StoreDriver {
  private data = new Map<string, unknown>();

  /**
   * @param ns - Namespace; keys from other namespaces are invisible.
   * @returns A key-value store scoped to `ns`.
   */
  namespace(ns: string): KeyValueStore {
    const k = (key: string): string => `${ns}::${key}`;
    const data = this.data;
    return {
      async get<T>(key: string): Promise<T | undefined> {
        const v = data.get(k(key));
        return v === undefined ? undefined : (structuredClone(v) as T);
      },
      async set<T>(key: string, value: T): Promise<void> {
        data.set(k(key), structuredClone(value));
      },
      async delete(key: string): Promise<void> {
        data.delete(k(key));
      },
      async list<T>(prefix: string): Promise<T[]> {
        const full = k(prefix);
        return [...data.keys()]
          .filter((key) => key.startsWith(full))
          .sort()
          .map((key) => structuredClone(data.get(key)) as T);
      },
    };
  }
}
