import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSearchIndex, structureName } from '../viewer/search.ts';
import { LANGS, type Lang, type Selection } from '../viewer/types.ts';
import { InfoPanel } from './InfoPanel.tsx';
import { OfflineDialog } from './OfflineDialog.tsx';
import { Bench } from './Bench.tsx';
import { Search } from './Search.tsx';
import { Tabs } from './Tabs.tsx';
import { Toolbar } from './Toolbar.tsx';
import { Tree } from './Tree.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';
import { useNarrow } from './useNarrow.ts';
import { usePwa } from './usePwa.ts';
import { useViewer } from './useViewer.ts';
import { S } from './strings.ts';

export function App() {
  const { canvasRef, viewer, snapshot, error, selectAndFocus } = useViewer();
  const pwa = usePwa();
  const narrow = useNarrow();
  const { view, ready, loading, failedKinds } = snapshot;
  const catalog = ready ? viewer?.catalog ?? null : null;
  const atlas = viewer?.atlas ?? null;
  const index = useMemo(() => (atlas ? buildSearchIndex(atlas) : null), [atlas]);
  const [hover, setHover] = useState<Selection | null>(null);
  const [tab, setTab] = useState('info');
  const [offlineOpen, setOfflineOpen] = useState(false);
  const offlineButton = useRef<HTMLButtonElement>(null);
  useEffect(() => viewer?.on('hover', setHover), [viewer]);
  // On a phone, tapping a structure shows its information.
  useEffect(() => viewer?.on('pick', (sel) => { if (sel) setTab('info'); }), [viewer]);

  const nameOf = (sel: Selection | null) => {
    const s = sel && catalog?.structure(sel.slug);
    return s && sel ? structureName(s, sel.side, view.lang) : '';
  };
  const pick = (slug: string) => selectAndFocus({ slug, side: null });

  const tree = catalog && <Tree catalog={catalog} lang={view.lang} selection={view.selection} onSelect={pick} />;
  const info = <InfoPanel catalog={catalog} lang={view.lang} selection={view.selection} onSelect={pick} />;
  const controls = viewer && catalog && <Toolbar viewer={viewer} view={view} kinds={catalog.kinds} maxLayer={catalog.maxLayer} />;

  return (
    <div className={`app${narrow ? ' is-narrow' : ''}`}>
      {pwa.updateReady && <UpdateBanner onReload={pwa.applyUpdate} onLater={pwa.dismissUpdate} />}
      <header className="header">
        <h1>{S.appTitle}</h1>
        {index && <Search index={index} lang={view.lang} onSelect={pick} />}
        <label className="lang">
          {S.nameLang}
          <select value={view.lang} onChange={(e) => viewer?.setState({ lang: e.target.value as Lang })}>
            {LANGS.map((l) => <option key={l} value={l}>{S.langs[l]}</option>)}
          </select>
        </label>
        {!pwa.online && <span className="offline-tag">{S.offlineTag}</span>}
        <button ref={offlineButton} type="button" onClick={() => setOfflineOpen(true)}>{S.offlineButton}</button>
      </header>
      <main className="stage">
        <canvas ref={canvasRef} className="canvas" role="img" aria-label={S.canvasLabel} aria-describedby="canvas-help" />
        <p id="canvas-help" className="visually-hidden">{S.canvasHelp}</p>
      </main>
      {narrow ? (
        <Tabs current={tab} onChange={setTab} panels={{ tree, info, controls }} />
      ) : (
        <>
          <nav className="sidebar" aria-label={S.treeLabel}>{tree}</nav>
          <aside className="info" aria-labelledby="info-title">
            <h2 id="info-title" className="visually-hidden">{S.panelTitle}</h2>
            {info}
          </aside>
          <section className="controls" aria-label={S.controlsLabel}>{controls}</section>
        </>
      )}
      <footer className="statusbar">
        <span>{loading ? S.loading(loading.loaded, loading.total) : hover ? `${S.hover} : ${nameOf(hover)}` : ' '}</span>
        {error && <span role="alert" className="error">{error}</span>}
        {failedKinds.length > 0 && <span role="alert">{(pwa.online ? S.failed : S.failedOffline)(failedKinds.join(', '))}</span>}
        <span className="credits">{S.credits} : {atlas?.attributions.map((a) => a.name).join(', ')} · {snapshot.backend ?? ''}</span>
      </footer>
      <div role="status" aria-live="polite" className="visually-hidden" data-testid="announce">
        {view.selection ? S.selected(nameOf(view.selection)) : ready ? S.cleared : ''}
      </div>
      {viewer && ready && new URLSearchParams(location.search).has('bench') && <Bench viewer={viewer} />}
      <OfflineDialog open={offlineOpen} onClose={() => { setOfflineOpen(false); offlineButton.current?.focus(); }}
        supported={pwa.supported} canInstall={pwa.canInstall} install={pwa.install} iosHint={pwa.iosHint} />
    </div>
  );
}
