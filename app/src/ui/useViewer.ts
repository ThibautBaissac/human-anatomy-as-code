import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Viewer, type Manifest, type ViewerSnapshot } from '../viewer/viewer.ts';
import { decodeView, encodeView, viewFromHash, type DecodeContext } from '../viewer/view-hash.ts';
import { structureName } from '../viewer/search.ts';
import { S } from './strings.ts';
import { ASSETS_CACHE } from '../offline/urls.ts';
import { DEFAULT_VIEW, type Atlas, type Model, type Selection } from '../viewer/types.ts';

const EMPTY: ViewerSnapshot = { view: DEFAULT_VIEW, loading: null, failedKinds: [], backend: null, ready: false };

const contextOf = (atlas: Atlas, manifest: Manifest): DecodeContext => {
  const slugs = new Set(atlas.structures.map((s) => s.slug));
  const bilateral = new Set(atlas.structures.filter((s) => s.sides).map((s) => s.slug));
  return { hasSlug: (s) => slugs.has(s), hasSides: (s) => bilateral.has(s), kinds: Object.keys(manifest.kinds), maxLayer: Math.max(0, ...atlas.structures.map((s) => s.layer ?? 0)) };
};

/** Creates the viewer on a canvas, loads the model's atlas and assets, keeps the URL hash in sync, switches models. */
export function useViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** announcement made when a model switch drops the selection */
  const [notice, setNotice] = useState<string | null>(null);
  const switchRef = useRef<(model: Model) => Promise<void>>(async () => {});

  useEffect(() => {
    let disposed = false;
    let v: Viewer | null = null;
    const cleanups: (() => void)[] = [];
    const base = import.meta.env.BASE_URL;
    const getJson = async <T,>(url: string, what: string): Promise<T> => {
      const r = await fetch(url).catch(() => null);
      if (!r?.ok) throw new Error(S.loadError(what));
      return r.json() as Promise<T>;
    };
    let manifest: Manifest;
    let ctx: DecodeContext;
    const atlasOf = (model: Model) => getJson<Atlas>(`${base}atlas-${model}.json`, `atlas-${model}.json`);

    /** Switches model: keeps camera, language, layers and sections; announces a selection the model does not have. */
    const switchModel = async (model: Model) => {
      if (!v || v.getState().model === model && v.atlas) return;
      const before = v.getState().selection;
      const beforeName = before && v.atlas ? structureName(v.atlas.structures.find((s) => s.slug === before.slug) ?? { slug: before.slug, labels: {} }, before.side, v.getState().lang) : null;
      const atlas = await atlasOf(model);
      if (disposed) return;
      ctx = contextOf(atlas, manifest);
      await v.load(atlas, manifest, `${base}assets/`, model);
      setNotice(before && !v.getState().selection ? S.notInModel(beforeName!, model) : null);
    };
    switchRef.current = (model) => switchModel(model).catch((e) => setError(String(e?.message ?? e)));

    (async () => {
      const backend = new URLSearchParams(location.search).get('backend') === 'webgl' ? 'webgl' : 'auto';
      v = await Viewer.create(canvasRef.current!, { backend });
      if (disposed) { v.dispose(); return; }
      setViewer(v);
      // Test hook used by the smoke test (e2e/smoke.spec.ts) and the bench page.
      (window as unknown as { __viewer: Viewer }).__viewer = v;
      const hashOf = () => location.hash.replace(/^#/, '');
      const model = decodeView(hashOf(), { hasSlug: () => false, kinds: [], maxLayer: 0 }).model ?? 'male';
      v.markLoadStart();
      const [atlas, m] = await Promise.all([atlasOf(model), getJson<Manifest>(`${base}assets/manifest.json`, 'assets/manifest.json')]);
      manifest = m;
      if (disposed) return;
      // Models already in the offline cache before this load? (transferSize cannot tell: service worker responses report 0)
      const files = (manifest.models?.[model]?.kinds ?? Object.keys(manifest.kinds)).map((k) => `${base}assets/${manifest.kinds[k].file}`);
      const cached = 'caches' in window && (await caches.has(ASSETS_CACHE))
        ? new Set((await (await caches.open(ASSETS_CACHE)).keys()).map((r) => new URL(r.url).pathname)) : new Set<string>();
      const hits = files.filter((f) => cached.has(f)).length;
      v.loadSource = hits === files.length ? 'cache' : hits ? 'partial-cache' : 'network';
      ctx = contextOf(atlas, manifest);
      const fromHash = decodeView(hashOf(), ctx);
      if (fromHash.camera || fromHash.lang) v.setState({ camera: fromHash.camera ?? null, lang: fromHash.lang ?? 'fr' });
      await v.load(atlas, manifest, `${base}assets/`, model);
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
      const onHash = async () => {
        if (hashOf() === written) return;
        const target = decodeView(hashOf(), ctx).model ?? 'male';
        if (target !== v!.getState().model) await switchModel(target);
        v!.setState(viewFromHash(decodeView(hashOf(), ctx), v!.getState()));
      };
      addEventListener('hashchange', onHash);
      cleanups.push(() => removeEventListener('hashchange', onHash));
    })().catch((e) => { console.error(e); if (!disposed) setError(String(e?.message ?? e)); });
    return () => { disposed = true; cleanups.forEach((c) => c()); v?.dispose(); };
  }, []);

  const subscribe = useCallback((cb: () => void) => (viewer ? viewer.on('change', cb) : () => {}), [viewer]);
  const snapshot = useSyncExternalStore(subscribe, () => viewer?.getSnapshot() ?? EMPTY);

  const selectAndFocus = useCallback((sel: Selection | null) => {
    if (!viewer) return;
    setNotice(null);
    viewer.select(sel);
    if (sel) viewer.focus(sel.slug, sel.side);
  }, [viewer]);
  const switchModel = useCallback((model: Model) => switchRef.current(model), []);

  return { canvasRef, viewer, snapshot, error, notice, selectAndFocus, switchModel };
}
