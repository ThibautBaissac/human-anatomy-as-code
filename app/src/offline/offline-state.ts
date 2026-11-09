// What is available offline, from the asset manifest and the cached URLs. Pure.
import { DATA_URLS, MANIFEST_URL, atlasUrl, modelUrl } from './urls.ts';
export interface AssetManifest {
  kinds: Record<string, { file: string; bytes: number }>;
  /** files (kind keys) each model needs */
  models?: Record<string, { kinds: string[]; totalBytes: number }>;
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

/** Model files of the given models (all files when no model is given or the manifest has none). */
export const modelUrls = (m: AssetManifest, models?: string[]) => {
  const kinds = models && m.models ? [...new Set(models.flatMap((x) => m.models![x]?.kinds ?? []))] : Object.keys(m.kinds);
  return kinds.map((k) => modelUrl(m.kinds[k].file)).sort();
};

export function offlineStatus(manifest: AssetManifest, cachedUrls: Iterable<string>, persisted: boolean, models?: string[]): OfflineStatus {
  const cached = new Set(cachedUrls);
  const sizes = new Map(Object.values(manifest.kinds).map((k) => [modelUrl(k.file), k.bytes]));
  const files = modelUrls(manifest, models);
  let cachedBytes = 0;
  for (const u of files) if (cached.has(u)) cachedBytes += sizes.get(u)!;
  const data = models && manifest.models ? [...models.map(atlasUrl), MANIFEST_URL] : DATA_URLS;
  const missing = [...files, ...data].filter((u) => !cached.has(u));
  const anyModel = files.some((u) => cached.has(u));
  const totalBytes = files.reduce((n, u) => n + sizes.get(u)!, 0);
  return { state: missing.length === 0 ? 'complete' : anyModel ? 'partial' : 'none', cachedBytes, totalBytes, missing, persisted };
}
