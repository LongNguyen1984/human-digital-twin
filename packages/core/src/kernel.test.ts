import { describe, expect, it } from 'vitest';
import { definePlugin, Kernel } from './kernel.js';
import { fold, hasAny } from './text.js';

declare module './types.js' {
  interface ServiceMap {
    'test.greeter': { hello(name: string): string };
  }
}

const p = (id: string, dependsOn: string[] = [], setup: any = () => {}) =>
  definePlugin({ manifest: { id, name: id, version: '0.0.0', dependsOn }, setup });

describe('Kernel.order', () => {
  it('loads dependencies first', () => {
    const order = Kernel.order([p('chat', ['profile']), p('tuvi', ['profile']), p('profile')]).map((x) => x.manifest.id);
    expect(order.indexOf('profile')).toBeLessThan(order.indexOf('chat'));
    expect(order.indexOf('profile')).toBeLessThan(order.indexOf('tuvi'));
  });

  it('fails on missing dependency', () => {
    expect(() => Kernel.order([p('tuvi', ['profile'])])).toThrow(/depends on 'profile'/);
  });

  it('fails on cycles', () => {
    expect(() => Kernel.order([p('a', ['b']), p('b', ['a'])])).toThrow(/cycle/);
  });
});

describe('Kernel wiring', () => {
  it('shares services, extensions and namespaced routes', async () => {
    const provider = p('greeter', [], (ctx: any) => {
      ctx.services.provide('test.greeter', { hello: (n: string) => `Chào ${n}` });
      ctx.routes.add({ method: 'GET', path: '/hi', handler: () => 'hi' });
    });
    let seen = '';
    const consumer = p('consumer', ['greeter'], (ctx: any) => {
      seen = ctx.services.use('test.greeter').hello('An');
      ctx.extensions.contribute('chat.topic', { id: 't', title: 'T', respond: () => ({ text: 'ok' }) });
    });
    const k = await new Kernel({ plugins: [consumer, provider], logger: silent }).boot();
    expect(seen).toBe('Chào An');
    expect(k.routes().map((r) => r.fullPath)).toEqual(['/api/greeter/hi']);
    expect(k.extensionsOf('chat.topic')).toHaveLength(1);
  });

  it('isolates plugin stores', async () => {
    let a: any, b: any;
    await new Kernel({
      plugins: [p('a', [], (c: any) => (a = c.store)), p('b', [], (c: any) => (b = c.store))],
      logger: silent,
    }).boot();
    await a.set('k', 1);
    expect(await b.get('k')).toBeUndefined();
  });

  it('disabled plugins are skipped', async () => {
    const k = await new Kernel({ plugins: [{ plugin: p('off'), enabled: false }, p('on')], logger: silent }).boot();
    expect(k.manifests().map((m) => m.id)).toEqual(['on']);
  });
});

describe('text helpers', () => {
  it('folds Vietnamese', () => {
    expect(fold('Đau Dạ Dày')).toBe('dau da day');
    expect(hasAny(fold('Tôi đau dạ dày'), ['da day'])).toBe('da day');
    expect(hasAny(fold('cabbage'), ['ba'])).toBeUndefined();
  });
});

const silent = { info() {}, warn() {}, error() {} };
