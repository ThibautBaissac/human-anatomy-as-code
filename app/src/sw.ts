/// <reference lib="webworker" />
// Service worker: precaches the app shell only; models and data are cached at run time.
import { CacheFirst, NetworkFirst, Serwist, type PrecacheEntry } from 'serwist';

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (PrecacheEntry | string)[] };

const ASSETS = 'haac-assets';
const DATA = 'haac-data';
const isModel = (url: URL) => url.origin === self.location.origin && /^\/assets\/[^/]+\.glb$/.test(url.pathname);
const isData = (url: URL) => url.origin === self.location.origin && (url.pathname === '/atlas.json' || url.pathname === '/assets/manifest.json');

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { navigateFallback: '/index.html', cleanupOutdatedCaches: true },
  // Updates wait for the user to accept them (banner); the very first install takes control at once.
  skipWaiting: false,
  clientsClaim: true,
  runtimeCaching: [
    // Models are content-addressed (name = hash), hence immutable.
    { matcher: ({ url }) => isModel(url), handler: new CacheFirst({ cacheName: ASSETS }) },
    { matcher: ({ url }) => isData(url), handler: new NetworkFirst({ cacheName: DATA, networkTimeoutSeconds: 3 }) },
  ],
});
serwist.addEventListeners();

/** Removes cached models that the current manifest no longer lists. */
async function cleanupModels(): Promise<void> {
  let res = await fetch('/assets/manifest.json').catch(() => undefined);
  if (!res?.ok) res = await (await caches.open(DATA)).match('/assets/manifest.json');
  if (!res) return;
  const manifest = (await res.json()) as { kinds: Record<string, { file: string }> };
  const keep = new Set(Object.values(manifest.kinds).map((k) => `/assets/${k.file}`));
  const cache = await caches.open(ASSETS);
  for (const req of await cache.keys()) if (!keep.has(new URL(req.url).pathname)) await cache.delete(req);
}
self.addEventListener('activate', (event) => event.waitUntil(cleanupModels()));
