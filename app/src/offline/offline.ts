// Offline manager (browser): reads what the service worker cached, downloads what is missing.
import { offlineStatus, type AssetManifest, type OfflineStatus } from './offline-state.ts';

export const CACHE_NAMES = ['haac-assets', 'haac-data'];

async function cachedUrls(): Promise<string[]> {
  const out: string[] = [];
  for (const name of CACHE_NAMES) {
    if (!(await caches.has(name))) continue;
    for (const req of await (await caches.open(name)).keys()) out.push(new URL(req.url).pathname);
  }
  return out;
}

export async function readStatus(manifest: AssetManifest): Promise<OfflineStatus> {
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) ?? false;
  return offlineStatus(manifest, await cachedUrls(), persisted);
}

/** Resolves once a service worker controls the page (its fetches are what fills the caches). */
async function controlled(): Promise<void> {
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return;
  await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
}

export class DownloadError extends Error {
  readonly status: OfflineStatus;
  constructor(status: OfflineStatus) { super('download'); this.status = status; }
}

/** Asks for persistent storage, then fetches every missing file through the service worker, two at a time. */
export async function makeAvailableOffline(manifest: AssetManifest, onProgress: (done: number, total: number) => void): Promise<OfflineStatus> {
  await controlled();
  await navigator.storage?.persist?.().catch(() => false);
  const before = await readStatus(manifest);
  const sizes = new Map(Object.values(manifest.kinds).map((k) => [`/assets/${k.file}`, k.bytes]));
  let done = before.cachedBytes;
  onProgress(done, manifest.totalBytes);
  const queue = [...before.missing];
  let failed = false;
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        await res.arrayBuffer();
        done += sizes.get(url) ?? 0;
        onProgress(done, manifest.totalBytes);
      } catch {
        failed = true;
      }
    }
  };
  await Promise.all([worker(), worker()]);
  const after = await readStatus(manifest);
  if (failed || after.state !== 'complete') throw new DownloadError(after);
  return after;
}
