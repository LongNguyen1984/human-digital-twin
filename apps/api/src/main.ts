import { buildServer } from './server.js';

const port = Number(process.env.PORT ?? 3000);
const { app, kernel } = await buildServer({ logger: true });
await app.listen({ port, host: '0.0.0.0' });
console.log(`Human Digital Twin API on http://localhost:${port}`);
console.log(`Plugins: ${kernel.manifests().map((m) => `${m.id}@${m.version}`).join(', ')}`);
