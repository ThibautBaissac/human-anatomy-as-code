import { useEffect, useMemo, useState } from 'react';
import { buildSearchIndex, structureName } from '../viewer/search.ts';
import { LANGS, type Lang, type Selection } from '../viewer/types.ts';
import { InfoPanel } from './InfoPanel.tsx';
import { Search } from './Search.tsx';
import { Toolbar } from './Toolbar.tsx';
import { Tree } from './Tree.tsx';
import { useViewer } from './useViewer.ts';
import { S } from './strings.ts';

export function App() {
  const { canvasRef, viewer, snapshot, error, selectAndFocus } = useViewer();
  const { view, ready, loading, failedKinds } = snapshot;
  const catalog = ready ? viewer?.catalog ?? null : null;
  const atlas = viewer?.atlas ?? null;
  const index = useMemo(() => (atlas ? buildSearchIndex(atlas) : null), [atlas]);
  const [hover, setHover] = useState<Selection | null>(null);
  useEffect(() => viewer?.on('hover', setHover), [viewer]);

  const nameOf = (sel: Selection | null) => {
    const s = sel && catalog?.structure(sel.slug);
    return s && sel ? structureName(s, sel.side, view.lang) : '';
  };
  const pick = (slug: string) => selectAndFocus({ slug, side: null });

  return (
    <div className="app">
      <header className="header">
        <h1>{S.appTitle}</h1>
        {index && <Search index={index} lang={view.lang} onSelect={pick} />}
        <label className="lang">
          {S.nameLang}
          <select value={view.lang} onChange={(e) => viewer?.setState({ lang: e.target.value as Lang })}>
            {LANGS.map((l) => <option key={l} value={l}>{S.langs[l]}</option>)}
          </select>
        </label>
      </header>
      <nav className="sidebar" aria-label={S.treeLabel}>
        {catalog && <Tree catalog={catalog} lang={view.lang} selection={view.selection} onSelect={pick} />}
      </nav>
      <main className="stage">
        <canvas ref={canvasRef} className="canvas" role="img" aria-label={S.canvasLabel} aria-describedby="canvas-help" />
        <p id="canvas-help" className="visually-hidden">{S.canvasHelp}</p>
      </main>
      <aside className="info" aria-labelledby="info-title">
        <h2 id="info-title" className="visually-hidden">{S.panelTitle}</h2>
        <InfoPanel catalog={catalog} lang={view.lang} selection={view.selection} onSelect={pick} />
      </aside>
      <section className="controls" aria-label={S.controlsLabel}>
        {viewer && catalog && <Toolbar viewer={viewer} view={view} kinds={catalog.kinds} maxLayer={catalog.maxLayer} />}
      </section>
      <footer className="statusbar">
        <span>{loading ? S.loading(loading.loaded, loading.total) : hover ? `${S.hover} : ${nameOf(hover)}` : ' '}</span>
        {error && <span role="alert" className="error">{error}</span>}
        {failedKinds.length > 0 && <span role="alert">{S.failed(failedKinds.join(', '))}</span>}
        <span className="credits">{S.credits} : {atlas?.attributions.map((a) => a.name).join(', ')} · {snapshot.backend ?? ''}</span>
      </footer>
      <div role="status" aria-live="polite" className="visually-hidden" data-testid="announce">
        {view.selection ? S.selected(nameOf(view.selection)) : ready ? S.cleared : ''}
      </div>
    </div>
  );
}
