import { ConsentService } from './consent.js';
import { EventBus } from './events.js';
import { FactService, type FactPolicy } from './facts.js';
import { InMemoryStoreDriver, type KeyValueStore, type StoreDriver } from './store.js';
import type {
  EventMap,
  ExtensionMap,
  FactHandler,
  MountedRoute,
  RouteDef,
  ServiceMap,
} from './types.js';

// ---------- Plugin contract ----------

export interface PluginManifest {
  /** Stable, url-safe id. Routes mount at /api/<id>. */
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Plugins that must load first (their services are used in setup). */
  dependsOn?: string[];
}

export interface Logger {
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

export interface PluginContext<Config = Record<string, unknown>> {
  pluginId: string;
  config: Config;
  log: Logger;
  /** Private key-value store, namespaced to this plugin. */
  store: KeyValueStore;
  events: {
    on<K extends keyof EventMap>(event: K, fn: (p: EventMap[K]) => void | Promise<void>): () => void;
    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void>;
  };
  services: {
    provide<K extends keyof ServiceMap>(name: K, impl: ServiceMap[K]): void;
    use<K extends keyof ServiceMap>(name: K): ServiceMap[K];
    has(name: keyof ServiceMap): boolean;
  };
  extensions: {
    contribute<K extends keyof ExtensionMap>(point: K, item: ExtensionMap[K]): void;
    all<K extends keyof ExtensionMap>(point: K): ExtensionMap[K][];
  };
  routes: { add(def: RouteDef): void };
  facts: {
    handle(handler: FactHandler): void;
    propose: FactService['propose'];
    confirm: FactService['confirm'];
    reject: FactService['reject'];
    list: FactService['list'];
    get: FactService['get'];
  };
  consent: ConsentService;
}

export interface HdtPlugin<Config = any> {
  manifest: PluginManifest;
  defaultConfig?: Config;
  setup(ctx: PluginContext<Config>): void | Promise<void>;
  /** Called after every plugin's setup, in load order. */
  start?(): void | Promise<void>;
  /** Called on shutdown, in reverse load order. */
  stop?(): void | Promise<void>;
}

/** Identity helper that gives plugin authors full type inference. */
export function definePlugin<Config = Record<string, unknown>>(p: HdtPlugin<Config>): HdtPlugin<Config> {
  return p;
}

// ---------- Kernel ----------

export interface PluginEntry {
  plugin: HdtPlugin;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface KernelOptions {
  plugins: Array<HdtPlugin | PluginEntry>;
  store?: StoreDriver;
  factPolicy?: FactPolicy;
  logger?: Logger;
}

const consoleLogger = (prefix: string): Logger => ({
  info: (m, x) => console.log(`[${prefix}] ${m}`, x ?? ''),
  warn: (m, x) => console.warn(`[${prefix}] ${m}`, x ?? ''),
  error: (m, x) => console.error(`[${prefix}] ${m}`, x ?? ''),
});

export class Kernel {
  readonly events: EventBus;
  readonly consent: ConsentService;
  readonly facts: FactService;
  private storeDriver: StoreDriver;
  private services = new Map<string, { owner: string; impl: unknown }>();
  private extensions = new Map<string, Array<{ owner: string; item: unknown }>>();
  private mounted: MountedRoute[] = [];
  private loaded: HdtPlugin[] = [];
  private entries: PluginEntry[];
  private logger: Logger;
  private booted = false;

  constructor(opts: KernelOptions) {
    this.logger = opts.logger ?? consoleLogger('kernel');
    this.storeDriver = opts.store ?? new InMemoryStoreDriver();
    this.events = new EventBus((err, ev, owner) => this.logger.error(`${owner} failed handling ${ev}`, err));
    this.consent = new ConsentService(this.storeDriver.namespace('_consent'), this.events);
    this.facts = new FactService(this.storeDriver.namespace('_facts'), this.events, this.consent, opts.factPolicy);
    this.entries = opts.plugins
      .map((p) => ('plugin' in p ? p : { plugin: p }))
      .filter((e) => e.enabled !== false);
  }

  /** Resolve load order from dependsOn; fails fast on missing deps or cycles. */
  static order(plugins: HdtPlugin[]): HdtPlugin[] {
    const byId = new Map<string, HdtPlugin>();
    for (const p of plugins) {
      if (byId.has(p.manifest.id)) throw new Error(`Duplicate plugin id '${p.manifest.id}'`);
      byId.set(p.manifest.id, p);
    }
    const out: HdtPlugin[] = [];
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (p: HdtPlugin, path: string[]) => {
      const id = p.manifest.id;
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'visiting') throw new Error(`Plugin dependency cycle: ${[...path, id].join(' → ')}`);
      state.set(id, 'visiting');
      for (const dep of p.manifest.dependsOn ?? []) {
        const d = byId.get(dep);
        if (!d) throw new Error(`Plugin '${id}' depends on '${dep}', which is not enabled`);
        visit(d, [...path, id]);
      }
      state.set(id, 'done');
      out.push(p);
    };
    for (const p of plugins) visit(p, []);
    return out;
  }

  async boot(): Promise<this> {
    if (this.booted) return this;
    const configs = new Map(this.entries.map((e) => [e.plugin.manifest.id, e.config]));
    const ordered = Kernel.order(this.entries.map((e) => e.plugin));
    for (const plugin of ordered) {
      const id = plugin.manifest.id;
      const ctx = this.contextFor(plugin, { ...(plugin.defaultConfig ?? {}), ...(configs.get(id) ?? {}) });
      await plugin.setup(ctx);
      this.loaded.push(plugin);
      this.logger.info(`loaded ${id}@${plugin.manifest.version}`);
    }
    for (const plugin of this.loaded) await plugin.start?.();
    this.booted = true;
    return this;
  }

  async shutdown(): Promise<void> {
    for (const plugin of [...this.loaded].reverse()) await plugin.stop?.();
  }

  routes(): MountedRoute[] {
    return [...this.mounted];
  }

  manifests() {
    return this.loaded.map((p) => p.manifest);
  }

  service<K extends keyof ServiceMap>(name: K): ServiceMap[K] {
    const s = this.services.get(name as string);
    if (!s) throw new Error(`Service '${String(name)}' is not provided by any enabled plugin`);
    return s.impl as ServiceMap[K];
  }

  extensionsOf<K extends keyof ExtensionMap>(point: K): ExtensionMap[K][] {
    return (this.extensions.get(point) ?? []).map((e) => e.item as ExtensionMap[K]);
  }

  private contextFor(plugin: HdtPlugin, config: Record<string, unknown>): PluginContext<any> {
    const owner = plugin.manifest.id;
    const declared = new Set(plugin.manifest.dependsOn ?? []);
    return {
      pluginId: owner,
      config,
      log: {
        info: (m, x) => this.logger.info(`${owner}: ${m}`, x),
        warn: (m, x) => this.logger.warn(`${owner}: ${m}`, x),
        error: (m, x) => this.logger.error(`${owner}: ${m}`, x),
      },
      store: this.storeDriver.namespace(owner),
      events: {
        on: (event, fn) => this.events.on(event, fn, owner),
        emit: (event, payload) => this.events.emit(event, payload),
      },
      services: {
        provide: (name, impl) => {
          const existing = this.services.get(name as string);
          if (existing) throw new Error(`Service '${String(name)}' already provided by '${existing.owner}'`);
          this.services.set(name as string, { owner, impl });
        },
        use: (name) => {
          const s = this.services.get(name as string);
          if (!s) {
            throw new Error(`Plugin '${owner}' needs service '${String(name)}'. Add its plugin to dependsOn and enable it.`);
          }
          if (s.owner !== owner && !declared.has(s.owner)) {
            this.logger.warn(`'${owner}' uses service '${String(name)}' from '${s.owner}' without declaring dependsOn`);
          }
          return s.impl as any;
        },
        has: (name) => this.services.has(name as string),
      },
      extensions: {
        contribute: (point, item) => {
          const list = this.extensions.get(point) ?? [];
          list.push({ owner, item });
          this.extensions.set(point, list);
        },
        // Read lazily so contributions from plugins loaded later are included.
        all: (point) => this.extensionsOf(point),
      },
      routes: {
        add: (def) => {
          const fullPath = `/api/${owner}${def.path === '/' ? '' : def.path}`;
          if (this.mounted.some((r) => r.method === def.method && r.fullPath === fullPath)) {
            throw new Error(`Route ${def.method} ${fullPath} registered twice`);
          }
          this.mounted.push({ ...def, pluginId: owner, fullPath });
        },
      },
      facts: {
        handle: (h) => this.facts.registerHandler(owner, h),
        propose: (d) => this.facts.propose(d),
        confirm: (id, v) => this.facts.confirm(id, v),
        reject: (id) => this.facts.reject(id),
        list: (p, s) => this.facts.list(p, s),
        get: (id) => this.facts.get(id),
      },
      consent: this.consent,
    };
  }
}
