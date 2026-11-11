// Offline manager (browser): reads what the service worker cached, downloads what is missing.
import { offlineStatus, type AssetManifest, type OfflineStatus } from './offline-state.ts';
import { ASSETS_CACHE, DATA_CACHE, modelUrl } from './urls.ts';

const CACHE_NAMES = [ASSETS_CACHE, DATA_CACHE];

async function cachedUrls(): Promise<string[]> {
  const out: string[] = [];
  for (const name of CACHE_NAMES) {
    if (!(await caches.has(name))) continue;
    for (const req of await (await caches.open(name)).keys()) out.push(new URL(req.url).pathname);
  }
  return out;
}

export async function readStatus(manifest: AssetManifest, models?: string[]): Promise<OfflineStatus> {
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
  return offlineStatus(manifest, await cachedUrls(), persisted, models);
}

export class NoControllerError extends Error {}

/** Resolves once a service worker controls the page (its fetches are what fills the caches); fails after 10 s. */
async function controlled(): Promise<void> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new NoControllerError('no service worker')), 10_000));
  await Promise.race([navigator.serviceWorker.ready, timeout]);
  if (navigator.serviceWorker.controller) return;
  await Promise.race([new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })), timeout]);
}

export class DownloadError extends Error {
  readonly status: OfflineStatus;
  constructor(status: OfflineStatus) { super('download'); this.status = status; }
}

/** Asks for persistent storage, then fetches every missing file through the service worker, two at a time. */
export async function makeAvailableOffline(manifest: AssetManifest, models: string[] | undefined, onProgress: (done: number, total: number) => void): Promise<OfflineStatus> {
  await controlled();
  await navigator.storage?.persist?.().catch(() => false);
  const before = await readStatus(manifest, models);
  const sizes = new Map(Object.values(manifest.kinds).map((k) => [modelUrl(k.file), k.bytes]));
  let done = before.cachedBytes;
  onProgress(done, before.totalBytes);
  const queue = [...before.missing];
  const fetched: string[] = [];
  let failed = false;
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        await res.arrayBuffer();
        fetched.push(url);
        done += sizes.get(url) ?? 0;
        onProgress(done, before.totalBytes);
      } catch {
        failed = true;
      }
    }
  };
  await Promise.all([worker(), worker()]);
  // The service worker stores a response after handing it over, and a failed store (quota) never reaches the page:
  // wait for the cache to list what was fetched, then count only what it lists.
  let cached = await cachedUrls();
  for (let i = 0; i < 50 && fetched.some((u) => !cached.includes(u)); i++) {
    await new Promise((r) => setTimeout(r, 200));
    cached = await cachedUrls();
  }
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
  const after = offlineStatus(manifest, cached, persisted, models);
  if (failed || after.state !== 'complete') throw new DownloadError(after);
  return after;
}
