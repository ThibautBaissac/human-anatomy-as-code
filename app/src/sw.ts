/// <reference lib="webworker" />
// Service worker: precaches the app shell only; models and data are cached at run time.
import { CacheFirst, NetworkFirst, Serwist, type PrecacheEntry } from 'serwist';
import { ASSETS_CACHE as ASSETS, DATA_CACHE as DATA, MANIFEST_URL, isDataPath, isModelPath, modelUrl } from './offline/urls.ts';

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: (PrecacheEntry | string)[] };

const isModel = (url: URL) => url.origin === self.location.origin && isModelPath(url.pathname);
const isData = (url: URL) => url.origin === self.location.origin && isDataPath(url.pathname);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { navigateFallback: '/index.html', cleanupOutdatedCaches: true },
  // Updates wait for the user to accept them (banner); the very first install takes control at once.
  skipWaiting: false,
  clientsClaim: true,
  runtimeCaching: [
    // Models are content-addressed (name = hash), hence immutable.
    { matcher: ({ url }) => isModel(url), handler: new CacheFirst({ cacheName: ASSETS }) },
    {
      matcher: ({ url }) => isData(url),
      handler: new NetworkFirst({
        cacheName: DATA,
        networkTimeoutSeconds: 3,
        // A data-only release changes the manifest but not sw.js (no activate): purge the old models when a new manifest is stored.
        plugins: [{ cacheDidUpdate: async ({ request }) => { if (new URL(request.url).pathname === MANIFEST_URL) await cleanupModels(true); } }],
      }),
    },
  ],
});
serwist.addEventListeners();

/** Removes cached models that the current manifest no longer lists (the cached one when `cachedOnly`). */
async function cleanupModels(cachedOnly = false): Promise<void> {
  let res = cachedOnly ? undefined : await fetch(MANIFEST_URL).catch(() => undefined);
  if (!res?.ok) res = await (await caches.open(DATA)).match(MANIFEST_URL);
  if (!res) return;
  const manifest = (await res.json()) as { kinds: Record<string, { file: string }> };
  const keep = new Set(Object.values(manifest.kinds).map((k) => modelUrl(k.file)));
  const cache = await caches.open(ASSETS);
  for (const req of await cache.keys()) if (!keep.has(new URL(req.url).pathname)) await cache.delete(req);
}
/** Removes cached data that is no longer served (the former atlas.json). */
async function cleanupData(): Promise<void> {
  const cache = await caches.open(DATA);
  for (const req of await cache.keys()) if (!isDataPath(new URL(req.url).pathname)) await cache.delete(req);
}
self.addEventListener('activate', (event) => event.waitUntil(Promise.all([cleanupModels(), cleanupData()])));
