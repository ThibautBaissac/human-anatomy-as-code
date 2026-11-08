import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Viewer, type Manifest, type ViewerSnapshot } from '../viewer/viewer.ts';
import { decodeView, encodeView } from '../viewer/view-hash.ts';
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
    (async () => {
      const backend = new URLSearchParams(location.search).get('backend') === 'webgl' ? 'webgl' : 'auto';
      v = await Viewer.create(canvasRef.current!, { backend });
      if (disposed) { v.dispose(); return; }
      setViewer(v);
      (window as unknown as { __viewer: Viewer }).__viewer = v;
      const base = import.meta.env.BASE_URL;
      const [atlas, manifest] = await Promise.all([
        fetch(`${base}atlas.json`).then((r) => r.json() as Promise<Atlas>),
        fetch(`${base}assets/manifest.json`).then((r) => r.json() as Promise<Manifest>),
      ]);
      const ctx = { hasSlug: (s: string) => atlas.structures.some((x) => x.slug === s), kinds: Object.keys(manifest.kinds), maxLayer: Math.max(0, ...atlas.structures.map((s) => s.layer ?? 0)) };
      const fromHash = decodeView(location.hash, ctx);
      if (fromHash.camera || fromHash.lang) v.setState({ camera: fromHash.camera ?? null, lang: fromHash.lang ?? 'fr' });
      await v.load(atlas, manifest, `${base}assets/`);
      v.setState(fromHash);
      // URL hash: written at most every 250 ms, read back on hashchange.
      let timer: number | undefined;
      let written = location.hash.replace(/^#/, '');
      v.on('change', (snap) => {
        clearTimeout(timer);
        timer = window.setTimeout(() => {
          written = encodeView(snap.view);
          history.replaceState(null, '', `${location.pathname}${location.search}${written ? `#${written}` : ''}`);
        }, 250);
      });
      addEventListener('hashchange', () => {
        const h = location.hash.replace(/^#/, '');
        if (h !== written) v!.setState(decodeView(h, ctx));
      });
    })().catch((e) => { console.error(e); setError(String(e?.message ?? e)); });
    return () => { disposed = true; v?.dispose(); };
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
