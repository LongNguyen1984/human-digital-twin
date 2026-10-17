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

/** Static description of a plugin. */
export interface PluginManifest {
  /** Stable, url-safe id. Routes mount at /api/<id>. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Plugin version, shown in the boot log (`loaded <id>@<version>`). */
  version: string;
  /** Optional short description. */
  description?: string;
  /** Plugins that must load first (their services are used in setup). */
  dependsOn?: string[];
}

/** Minimal structured logger. */
export interface Logger {
  /** Log an informational message. */
  info(msg: string, meta?: unknown): void;
  /** Log a warning. */
  warn(msg: string, meta?: unknown): void;
  /** Log an error. */
  error(msg: string, meta?: unknown): void;
}

/** Everything a plugin can use during `setup`; built by the kernel per plugin. */
export interface PluginContext<Config = Record<string, unknown>> {
  /** Id of the plugin this context belongs to. */
  pluginId: string;
  /** `defaultConfig` merged with the config from its `PluginEntry`. */
  config: Config;
  /** Logger that prefixes messages with the plugin id. */
  log: Logger;
  /** Private key-value store, namespaced to this plugin. */
  store: KeyValueStore;
  /** Shared event bus; handlers registered here are owned by this plugin. */
  events: {
    on<K extends keyof EventMap>(event: K, fn: (p: EventMap[K]) => void | Promise<void>): () => void;
    emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): Promise<void>;
  };
  /**
   * Service registry. `provide` throws if the name is already provided; `use`
   * throws if the service is missing and warns if its provider is not in `dependsOn`.
   */
  services: {
    provide<K extends keyof ServiceMap>(name: K, impl: ServiceMap[K]): void;
    use<K extends keyof ServiceMap>(name: K): ServiceMap[K];
    has(name: keyof ServiceMap): boolean;
  };
  /** Extension points. `all` is read lazily, so it includes later plugins' contributions. */
  extensions: {
    contribute<K extends keyof ExtensionMap>(point: K, item: ExtensionMap[K]): void;
    all<K extends keyof ExtensionMap>(point: K): ExtensionMap[K][];
  };
  /** `add` mounts a route at `/api/<pluginId><path>`; throws on duplicate method + path. */
  routes: { add(def: RouteDef): void };
  /** Facts pipeline; `handle` registers this plugin as owner of a fact kind. */
  facts: {
    handle(handler: FactHandler): void;
    propose: FactService['propose'];
    confirm: FactService['confirm'];
    reject: FactService['reject'];
    list: FactService['list'];
    get: FactService['get'];
  };
  /** Shared consent service. */
  consent: ConsentService;
}

/** A plugin: a manifest plus lifecycle hooks. */
export interface HdtPlugin<Config = any> {
  /** Static description: id, version, dependencies. */
  manifest: PluginManifest;
  /** Config defaults; overridden key by key by `PluginEntry.config`. */
  defaultConfig?: Config;
  /** Wire up services, routes, events and fact handlers. Runs in dependency order. */
  setup(ctx: PluginContext<Config>): void | Promise<void>;
  /** Called after every plugin's setup, in load order. */
  start?(): void | Promise<void>;
  /** Called on shutdown, in reverse load order. */
  stop?(): void | Promise<void>;
}

/**
 * Identity helper that gives plugin authors full type inference.
 * @param p - The plugin definition.
 * @returns `p`, unchanged.
 * @example
 * export default definePlugin({
 *   manifest: { id: 'hello', name: 'Hello', version: '0.1.0' },
 *   setup(ctx) {
 *     ctx.routes.add({ method: 'GET', path: '/', handler: () => ({ hello: 'world' }) });
 *   },
 * });
 */
export function definePlugin<Config = Record<string, unknown>>(p: HdtPlugin<Config>): HdtPlugin<Config> {
  return p;
}

// ---------- Kernel ----------

/** A plugin with per-deployment config and an on/off switch. */
export interface PluginEntry {
  /** The plugin to load. */
  plugin: HdtPlugin;
  /** Overrides merged over the plugin's `defaultConfig`. */
  config?: Record<string, unknown>;
  /** Set to `false` to skip the plugin. Defaults to `true`. */
  enabled?: boolean;
}

/** Options for {@link Kernel}. */
export interface KernelOptions {
  /** Plugins to load, bare or wrapped in a `PluginEntry`. */
  plugins: Array<HdtPlugin | PluginEntry>;
  /** Storage driver. Defaults to `InMemoryStoreDriver`. */
  store?: StoreDriver;
  /** Facts policy. Defaults to the `FactService` default policy. */
  factPolicy?: FactPolicy;
  /** Logger. Defaults to a console logger. */
  logger?: Logger;
}

const consoleLogger = (prefix: string): Logger => ({
  info: (m, x) => console.log(`[${prefix}] ${m}`, x ?? ''),
  warn: (m, x) => console.warn(`[${prefix}] ${m}`, x ?? ''),
  error: (m, x) => console.error(`[${prefix}] ${m}`, x ?? ''),
});

/**
 * Loads plugins, wires their contexts and owns the shared services.
 *
 * Lifecycle: `new Kernel(opts)` → `boot()` (every `setup` in dependency order,
 * then every `start` in load order) → serve `routes()` → `shutdown()`.
 * @example
 * const kernel = await new Kernel({ plugins: [profile, tuvi] }).boot();
 * for (const r of kernel.routes()) console.log(r.method, r.fullPath);
 * await kernel.shutdown();
 */
export class Kernel {
  /** Shared event bus; handler errors are logged through the kernel logger. */
  readonly events: EventBus;
  /** Shared consent service (`_consent` namespace). */
  readonly consent: ConsentService;
  /** Shared facts pipeline (`_facts` namespace). */
  readonly facts: FactService;
  private storeDriver: StoreDriver;
  private services = new Map<string, { owner: string; impl: unknown }>();
  private extensions = new Map<string, Array<{ owner: string; item: unknown }>>();
  private mounted: MountedRoute[] = [];
  private loaded: HdtPlugin[] = [];
  private entries: PluginEntry[];
  private logger: Logger;
  private booted = false;

  /**
   * Create the shared services. Disabled entries (`enabled: false`) are dropped here.
   * No plugin code runs until {@link boot}.
   * @param opts - Plugins and optional store, facts policy and logger.
   */
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

  /**
   * Resolve load order from dependsOn; fails fast on missing deps or cycles.
   * @param plugins - Enabled plugins.
   * @returns The plugins, each placed after its dependencies.
   * @throws Error on duplicate plugin ids, missing (or disabled) dependencies, or dependency cycles.
   */
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

  /**
   * Load every enabled plugin: run `setup` in dependency order, then `start` in
   * load order. Idempotent: later calls return immediately.
   * @returns This kernel, for chaining.
   * @throws Errors from {@link Kernel.order} and from any plugin's `setup` or `start`.
   */
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

  /** Call every loaded plugin's `stop`, in reverse load order. */
  async shutdown(): Promise<void> {
    for (const plugin of [...this.loaded].reverse()) await plugin.stop?.();
  }

  /** @returns A copy of all mounted routes, in registration order. */
  routes(): MountedRoute[] {
    return [...this.mounted];
  }

  /** @returns Manifests of the loaded plugins, in load order. */
  manifests(): PluginManifest[] {
    return this.loaded.map((p) => p.manifest);
  }

  /**
   * Look up a service provided by a plugin.
   * @param name - Service name from `ServiceMap`.
   * @returns The service implementation.
   * @throws Error if no enabled plugin provides the service.
   */
  service<K extends keyof ServiceMap>(name: K): ServiceMap[K] {
    const s = this.services.get(name as string);
    if (!s) throw new Error(`Service '${String(name)}' is not provided by any enabled plugin`);
    return s.impl as ServiceMap[K];
  }

  /**
   * @param point - Extension point name from `ExtensionMap`.
   * @returns All contributions to `point`, in contribution order.
   */
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
