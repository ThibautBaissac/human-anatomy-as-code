import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Viewer, type Manifest, type ViewerSnapshot } from '../viewer/viewer.ts';
import { decodeView, encodeView, viewFromHash } from '../viewer/view-hash.ts';
import { S } from './strings.ts';
import type { Atlas, Selection } from '../viewer/types.ts';

const EMPTY: ViewerSnapshot = { view: { selection: null, layerCut: 0, ghost: false, hiddenKinds: [], sections: {}, lang: 'fr', camera: null }, loading: null, failedKinds: [], backend: null, ready: false };

/** Creates the viewer on a canvas, loads the atlas and the assets, keeps the URL hash in sync. */
export function useViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let v: Viewer | null = null;
    const cleanups: (() => void)[] = [];
    const getJson = async <T,>(url: string, what: string): Promise<T> => {
      const r = await fetch(url).catch(() => null);
      if (!r?.ok) throw new Error(S.loadError(what));
      return r.json() as Promise<T>;
    };
    (async () => {
      const backend = new URLSearchParams(location.search).get('backend') === 'webgl' ? 'webgl' : 'auto';
      v = await Viewer.create(canvasRef.current!, { backend });
      if (disposed) { v.dispose(); return; }
      setViewer(v);
      // Test hook used by the smoke test (e2e/smoke.spec.ts).
      (window as unknown as { __viewer: Viewer }).__viewer = v;
      const base = import.meta.env.BASE_URL;
      v.markLoadStart();
      const [atlas, manifest] = await Promise.all([
        getJson<Atlas>(`${base}atlas.json`, 'atlas.json'),
        getJson<Manifest>(`${base}assets/manifest.json`, 'assets/manifest.json'),
      ]);
      if (disposed) return;
      const bilateral = new Set(atlas.structures.filter((s) => s.sides).map((s) => s.slug));
      const slugs = new Set(atlas.structures.map((s) => s.slug));
      const ctx = { hasSlug: (s: string) => slugs.has(s), hasSides: (s: string) => bilateral.has(s), kinds: Object.keys(manifest.kinds), maxLayer: Math.max(0, ...atlas.structures.map((s) => s.layer ?? 0)) };
      const hashOf = () => location.hash.replace(/^#/, '');
      const fromHash = decodeView(hashOf(), ctx);
      if (fromHash.camera || fromHash.lang) v.setState({ camera: fromHash.camera ?? null, lang: fromHash.lang ?? 'fr' });
      await v.load(atlas, manifest, `${base}assets/`);
      if (disposed) return;
      v.setState(fromHash);
      // URL hash: written at most every 250 ms, read back on hashchange (absent parameters → defaults).
      let timer: number | undefined;
      let written = hashOf();
      cleanups.push(v.on('change', (snap) => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          written = encodeView(snap.view);
          history.replaceState(null, '', `${location.pathname}${location.search}${written ? `#${written}` : ''}`);
        }, 250);
      }));
      cleanups.push(() => clearTimeout(timer));
      const onHash = () => { if (hashOf() !== written) v!.setState(viewFromHash(decodeView(hashOf(), ctx), v!.getState())); };
      addEventListener('hashchange', onHash);
      cleanups.push(() => removeEventListener('hashchange', onHash));
    })().catch((e) => { console.error(e); if (!disposed) setError(String(e?.message ?? e)); });
    return () => { disposed = true; cleanups.forEach((c) => c()); v?.dispose(); };
  }, []);

  const subscribe = useCallback((cb: () => void) => (viewer ? viewer.on('change', cb) : () => {}), [viewer]);
  const snapshot = useSyncExternalStore(subscribe, () => viewer?.getSnapshot() ?? EMPTY);

  const selectAndFocus = useCallback((sel: Selection | null) => {
    if (!viewer) return;
    viewer.select(sel);
    if (sel) viewer.focus(sel.slug, sel.side);
  }, [viewer]);

  return { canvasRef, viewer, snapshot, error, selectAndFocus };
}
