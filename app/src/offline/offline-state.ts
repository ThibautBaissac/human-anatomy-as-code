// What is available offline, from the asset manifest and the cached URLs. Pure.
export interface AssetManifest {
  kinds: Record<string, { file: string; bytes: number }>;
  totalBytes: number;
}

export interface OfflineStatus {
  state: 'none' | 'partial' | 'complete';
  cachedBytes: number;
  totalBytes: number;
  /** URLs still to download, models first */
  missing: string[];
  persisted: boolean;
}

/** URLs the app needs offline besides the models. */
export const DATA_URLS = ['/atlas.json', '/assets/manifest.json'];

export const modelUrls = (m: AssetManifest, base = '/') => Object.values(m.kinds).map((k) => `${base}assets/${k.file}`).sort();

export function offlineStatus(manifest: AssetManifest, cachedUrls: Iterable<string>, persisted: boolean): OfflineStatus {
  const cached = new Set(cachedUrls);
  const sizes = new Map(Object.values(manifest.kinds).map((k) => [`/assets/${k.file}`, k.bytes]));
  const models = modelUrls(manifest);
  let cachedBytes = 0;
  for (const u of models) if (cached.has(u)) cachedBytes += sizes.get(u)!;
  const missing = [...models, ...DATA_URLS].filter((u) => !cached.has(u));
  const anyModel = models.some((u) => cached.has(u));
  return { state: missing.length === 0 ? 'complete' : anyModel ? 'partial' : 'none', cachedBytes, totalBytes: manifest.totalBytes, missing, persisted };
}
