import { afterEach, expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ DurableObject: class {} }));
import worker from '../../src/worker';

const cookie = `max_admin=as1_${'a'.repeat(64)}`;
const request = (overrides = {}, headers = {}) => new Request('https://max.test/api/hud/web-query', {
  method: 'POST', headers: { Origin: 'https://max.test', Cookie: cookie, ...headers },
  body: JSON.stringify({ prompt: 'orbital research', maxCompute: '0.000000', chainId: 8453, ...overrides }),
});
const environment = () => ({
  ADMIN_PASSWORD: 'synthetic',
  ADMIN_SESSIONS: { idFromName: () => ({}), get: () => ({ fetch: async () => new Response(null, { status: 204 }) }) },
  BEEMAX_WEB_SEARCH_API_KEY: 'synthetic-search-key',
  BEEMAX_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
  PRIVATE_WWW_FEED_URL: 'https://private.test/feed', PRIVATE_WWW_FEED_TOKEN: 'synthetic-private-token',
  PUBLIC_FEEDS_JSON: JSON.stringify([{ url: 'https://feeds.test/rss' }]),
  KV_BINDING: { get: vi.fn(), put: vi.fn() }, AI: { run: vi.fn() },
});
afterEach(() => vi.unstubAllGlobals());
it('searches only the explicit query and keeps results out of feeds, AI, and shared caches', async () => {
  const remote = vi.fn(async () => Response.json({ web: { results: [
    { title: 'Orbit', description: '<b>Public</b> excerpt', url: 'https://example.test/orbit' },
    { title: 'Unsafe', url: 'javascript:alert(1)' },
  ] } }));
  vi.stubGlobal('fetch', remote);
  const env = environment();
  const response = await worker.fetch(request(), env as any, {} as any);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ summary: 'Orbit\nPublic excerpt', sources: ['https://example.test/orbit'], max_compute: '0.000000' });
  expect(remote).toHaveBeenCalledTimes(1);
  const [url, options] = remote.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.origin + url.pathname).toBe('https://api.search.brave.com/res/v1/web/search');
  expect(url.searchParams.get('q')).toBe('orbital research');
  expect(options).toMatchObject({ redirect: 'error', headers: { 'X-Subscription-Token': 'synthetic-search-key' } });
  expect(JSON.stringify(options)).not.toContain('synthetic-private-token');
  expect(env.KV_BINDING.get).not.toHaveBeenCalled(); expect(env.KV_BINDING.put).not.toHaveBeenCalled();
  expect(env.AI.run).not.toHaveBeenCalled();
});
it('rejects missing, expired and cross-origin sessions before search', async () => {
  const remote = vi.fn(); vi.stubGlobal('fetch', remote);
  const env = environment();
  expect((await worker.fetch(request({}, { Cookie: '' }), env as any, {} as any)).status).toBe(401);
  expect((await worker.fetch(request({}, { Origin: 'https://other.test' }), env as any, {} as any)).status).toBe(403);
  env.ADMIN_SESSIONS.get = () => ({ fetch: async () => new Response(null, { status: 401 }) });
  expect((await worker.fetch(request(), env as any, {} as any)).status).toBe(401);
  expect(remote).not.toHaveBeenCalled();
});
it('fails closed for configuration, invalid inputs, limits and provider failures', async () => {
  const remote = vi.fn(async () => new Response('provider secret', { status: 500 })); vi.stubGlobal('fetch', remote);
  const env = environment();
  expect((await worker.fetch(request(), { ...env, BEEMAX_WEB_SEARCH_API_KEY: undefined } as any, {} as any)).status).toBe(503);
  for (const overrides of [{ prompt: '' }, { prompt: 'x'.repeat(6001) }, { maxCompute: '1.000000' }, { chainId: 1 }]) {
    expect((await worker.fetch(request(overrides), env as any, {} as any)).status).toBe(400);
  }
  expect(env.BEEMAX_LIMITER.limit).not.toHaveBeenCalled();
  env.BEEMAX_LIMITER.limit.mockResolvedValueOnce({ success: false });
  expect((await worker.fetch(request(), env as any, {} as any)).status).toBe(429);
  expect(remote).not.toHaveBeenCalled();
  const failed = await worker.fetch(request(), env as any, {} as any);
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('provider secret');
});
