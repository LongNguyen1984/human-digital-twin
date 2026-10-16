#!/usr/bin/env node
// Usage: pnpm new-plugin community "Community rooms"
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [id, name = id] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('Usage: pnpm new-plugin <id> "<Display name>"   (id: lowercase, e.g. community)');
  process.exit(1);
}
const root = new URL('..', import.meta.url).pathname;
const dest = join(root, 'plugins', id);
if (existsSync(dest)) {
  console.error(`plugins/${id} already exists`);
  process.exit(1);
}
cpSync(join(root, 'plugins', '_template'), dest, { recursive: true });

const pascal = id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
const walk = (dir) =>
  readdirSync(dir).forEach((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__ID__', id).replaceAll('__NAME__', name).replaceAll('__PASCAL__', pascal));
  });
walk(dest);

console.log(`Created plugins/${id}.
Next:
  1. pnpm install
  2. Add "@hdt/plugin-${id}": "workspace:*" to apps/api/package.json
  3. Import it in apps/api/src/plugins.config.ts and add { plugin: ${pascal.charAt(0).toLowerCase() + pascal.slice(1)} }`);
