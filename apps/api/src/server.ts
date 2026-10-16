import Fastify, { type FastifyInstance } from 'fastify';
import { HttpError, Kernel, type KernelOptions } from '@hdt/core';
import { plugins as defaultPlugins } from './plugins.config.js';

export interface ServerOptions extends Partial<Omit<KernelOptions, 'logger'>> {
  logger?: boolean;
}

export async function buildServer(opts: ServerOptions = {}): Promise<{ app: FastifyInstance; kernel: Kernel }> {
  const kernel = await new Kernel({
    plugins: opts.plugins ?? defaultPlugins,
    store: opts.store,
    factPolicy: opts.factPolicy,
    logger: opts.logger === false ? { info() {}, warn() {}, error: console.error } : undefined,
  }).boot();

  const app = Fastify({ logger: opts.logger ?? false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: err.message, details: err.details });
    }
    if ((err as any)?.validation) return reply.status(400).send({ error: (err as Error).message });
    app.log.error(err);
    return reply.status(500).send({ error: 'Internal error' });
  });

  app.get('/health', async () => ({ ok: true }));
  app.get('/api/_system/plugins', async () => kernel.manifests());
  app.get('/api/_system/routes', async () =>
    kernel.routes().map(({ method, fullPath, pluginId, summary }) => ({ method, path: fullPath, plugin: pluginId, summary })),
  );
  app.get('/api/_system/fact-kinds', async () => kernel.facts.kinds());

  for (const route of kernel.routes()) {
    app.route({
      method: route.method,
      url: route.fullPath,
      handler: async (req) =>
        route.handler({
          params: (req.params ?? {}) as Record<string, string>,
          query: (req.query ?? {}) as Record<string, string | undefined>,
          body: req.body,
          // Auth plugin (roadmap) will set this from the session token.
          actorId: req.headers['x-person-id'] as string | undefined,
        }),
    });
  }

  app.addHook('onClose', () => kernel.shutdown());
  return { app, kernel };
}
