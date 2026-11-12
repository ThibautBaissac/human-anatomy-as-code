import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Menu, Play, Search as SearchIcon, X } from 'lucide-react';
import { jointKey, jointsFor } from '../viewer/pose.ts';
import { buildSearchIndex, structureName, suggestions } from '../viewer/search.ts';
import { LANGS, type Lang, type Model, type Selection, type Side } from '../viewer/types.ts';
import type { Viewer } from '../viewer/viewer.ts';
import { InfoCard } from './InfoCard.tsx';
import { MoreMenu, type MenuEntry } from './MoreMenu.tsx';
import { OfflineDialog } from './OfflineDialog.tsx';
import { CreditsDialog } from './CreditsDialog.tsx';
import { Bench } from './Bench.tsx';
import { FemaleNotice } from './FemaleNotice.tsx';
import { Banners, CameraGroup, HelpDialog, HoverLabel, Notifications, Welcome } from './Overlays.tsx';
import { Search } from './Search.tsx';
import { Sheet } from './Sheet.tsx';
import { Tabs } from './Tabs.tsx';
import { DissectionPanel, LayersPanel, MotionTool, playJoint, SectionsPanel, ToolButton, toolModified, TOOLS, type Tool } from './Tools.tsx';
import { Tree } from './Tree.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';
import type { SheetHeight } from './layout.ts';
import { useNarrow } from './useNarrow.ts';
import { usePwa } from './usePwa.ts';
import { useViewer } from './useViewer.ts';
import { useViewInsets } from './useViewInsets.ts';
import { THEMES, useTheme, type ThemeChoice } from './useTheme.ts';
import { QUALITIES, useQuality } from './useQuality.ts';
import type { Quality } from '../viewer/rendering.ts';
import { S } from './strings.ts';

const SIDES: Side[] = ['left', 'right'];
/** offered on an empty search: a few well-known structures across systems */
const SUGGESTED = ['heart', 'skull', 'femur', 'gluteus-maximus', 'stomach', 'kidney'];
const DRAWER_KEY = 'haac.drawer';
const readDrawer = () => {
  try { const v = localStorage.getItem(DRAWER_KEY); if (v === '1' || v === '0') return v === '1'; } catch { /* storage unavailable */ }
  return innerWidth >= 1200;
};
const writeDrawer = (open: boolean) => { try { localStorage.setItem(DRAWER_KEY, open ? '1' : '0'); } catch { /* storage unavailable */ } };
const isTextEntry = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !(t instanceof HTMLInputElement && ['checkbox', 'range', 'radio'].includes(t.type)));

/** The joint-side a selection takes part in and that can be animated, if any. */
function jointOfSelection(viewer: Viewer | null, sel: Selection | null): string | null {
  const s = sel && viewer?.catalog?.structure(sel.slug);
  if (!viewer || !s) return null;
  for (const j of jointsFor(viewer.joints, s)) {
    for (const side of sel.side ? [sel.side] : SIDES) if (viewer.rigs[jointKey(j.slug, side)]) return jointKey(j.slug, side);
  }
  return null;
}

export function App() {
  const { canvasRef, viewer, snapshot, error, notice, switching, selectAndFocus, switchModel } = useViewer();
  const pwa = usePwa();
  const theme = useTheme();
  /** the model a switch is going to, while it loads */
  const [switchTarget, setSwitchTarget] = useState<Model | null>(null);
  useEffect(() => { if (!switching) setSwitchTarget(null); }, [switching]);
  const toModel = (m: Model) => { if (m === view.model) return; setSwitchTarget(m); switchModel(m); };
  const narrow = useNarrow();
  /** a desktop window too narrow for the toolbar and the camera presets side by side */
  const compact = useNarrow('(max-width: 1200px)');
  const quality = useQuality(viewer, narrow);
  const { view, ready, loading, failedKinds } = snapshot;
  const catalog = ready ? viewer?.catalog ?? null : null;
  const atlas = viewer?.atlas ?? null;
  const index = useMemo(() => (atlas ? buildSearchIndex(atlas) : null), [atlas]);
  const tryThese = useMemo(() => (index ? suggestions(index, SUGGESTED, view.lang) : []), [index, view.lang]);
  const [hover, setHover] = useState<Selection | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  const toolButtons = useRef<Partial<Record<Tool, HTMLButtonElement | null>>>({});
  const [drawerOpen, setDrawerOpen] = useState(readDrawer);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [motionKey, setMotionKey] = useState<string | null>(null);
  // phone
  const [sheet, setSheet] = useState<SheetHeight>('folded');
  const [tab, setTab] = useState('info');
  const [phoneTool, setPhoneTool] = useState<Tool>('layers');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const drawerToggle = useRef<HTMLButtonElement>(null);
  /** where focus goes when the control holding it disappears (card closed, banner done): the search, always there */
  const focusHome = () => requestAnimationFrame(() => {
    (narrow ? searchButton.current : document.querySelector<HTMLElement>('.header [role=combobox]'))?.focus();
  });

  useEffect(() => viewer?.on('hover', setHover), [viewer]);
  // On a phone, tapping a structure shows its information.
  useEffect(() => viewer?.on('pick', (sel) => { if (sel) { setTab('info'); setSheet((h) => (h === 'folded' ? 'half' : h)); } }), [viewer]);
  // A structure picked under a panel (or too small to see) is brought into view, once the card or the sheet has opened.
  useEffect(() => viewer?.on('pick', (sel) => {
    if (sel) requestAnimationFrame(() => requestAnimationFrame(() => viewer.reveal(sel)));
  }), [viewer]);
  useViewInsets(viewer, narrow, sheet, `${drawerOpen}|${!!view.selection}|${ready}|${tool}`);
  // The Mouvement tool follows the selection when it takes part in a joint.
  const selectionJoint = useMemo(() => jointOfSelection(viewer, view.selection), [viewer, catalog, view.selection]);
  useEffect(() => { if (selectionJoint) setMotionKey(selectionJoint); }, [selectionJoint]);

  const nameOf = useCallback((sel: Selection | null) => {
    const s = sel && catalog?.structure(sel.slug);
    return s && sel ? structureName(s, sel.side, view.lang) : '';
  }, [catalog, view.lang]);
  // stable across renders: the tree is memoised and must not re-render on every frame of a playback
  const pick = useCallback((slug: string) => selectAndFocus({ slug, side: null }), [selectAndFocus]);

  const toggleTool = (t: Tool) => setTool((cur) => (cur === t ? null : t));
  /** Closes the open tool panel (× or Échap) and gives the focus back to its toolbar button. */
  const closeTool = () => {
    const t = tool;
    setTool(null);
    if (t) toolButtons.current[t]?.focus();
  };
  const toggleDrawer = () => setDrawerOpen((o) => { writeDrawer(!o); return !o; });
  const animate = () => {
    if (!viewer || !selectionJoint) return;
    setMotionKey(selectionJoint);
    if (narrow) { setTab('tools'); setPhoneTool('motion'); setSheet((h) => (h === 'folded' ? 'half' : h)); }
    else setTool('motion');
    playJoint(viewer, selectionJoint);
  };

  // Échap closes the topmost thing (dialogs, the menu and the search handle their own); Ctrl/⌘ + Z shows the last hidden structure again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape' && tool) {
        closeTool();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTextEntry(e.target) && view.hidden.length) {
        e.preventDefault();
        viewer?.undoHide();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [tool, viewer, view.hidden.length]);

  const setHidden = useCallback((slug: string, on: boolean) => viewer?.setHidden(slug, on), [viewer]);
  const tree = catalog && <Tree catalog={catalog} lang={view.lang} selection={view.selection} hidden={view.hidden} onSelect={pick} onHidden={setHidden} />;
  const card = viewer && catalog && view.selection && (
    <InfoCard viewer={viewer} catalog={catalog} view={{ ...view, selection: view.selection }} motionKey={motionKey} animatable={!!selectionJoint}
      onSelect={selectAndFocus} onClose={() => { viewer.select(null); focusHome(); }} onHide={() => { viewer.hideSelection(); focusHome(); }} onAnimate={animate} />
  );
  const toolContent = (t: Tool) => viewer && catalog && (
    t === 'layers' ? <LayersPanel viewer={viewer} view={view} kinds={catalog.kinds} systems={catalog.systems} />
      : t === 'dissection' ? <DissectionPanel viewer={viewer} view={view} catalog={catalog} />
        : t === 'sections' ? <SectionsPanel viewer={viewer} view={view} />
          : <MotionTool viewer={viewer} view={view} motionKey={motionKey} onChoose={setMotionKey} />
  );

  const modelEntries: MenuEntry[] = narrow ? [
    { kind: 'radio', group: S.modelLabel, options: (['male', 'female'] as Model[]).map((m) => ({ value: m, label: S.models[m] })), value: view.model, onChange: (m) => { if (ready && !switching) toModel(m as Model); } },
    { kind: 'radio', group: S.namesLabel, options: LANGS.map((l) => ({ value: l, label: S.langs[l] })), value: view.lang, onChange: (l) => viewer?.setState({ lang: l as Lang }) },
  ] : [];
  const menu: MenuEntry[] = [
    ...modelEntries,
    { kind: 'radio', group: S.themeLabel, options: THEMES.map((t) => ({ value: t, label: S.themes[t] })), value: theme.choice, onChange: (t) => theme.choose(t as ThemeChoice) },
    { kind: 'radio', group: S.qualityLabel, options: QUALITIES.map((q) => ({ value: q, label: S.qualities[q] })), value: quality.quality, onChange: (q) => quality.choose(q as Quality) },
    { kind: 'item', label: S.menuOffline, onSelect: () => setOfflineOpen(true) },
    { kind: 'item', label: S.menuCredits, onSelect: () => setCreditsOpen(true) },
    { kind: 'item', label: S.menuHelp, onSelect: () => setHelpOpen(true) },
  ];
  const offlineTag = <span role="status" className={pwa.online ? 'visually-hidden' : 'offline-tag'}>{pwa.online ? '' : S.offlineTag}</span>;
  const isolatedName = view.isolated && catalog?.structure(view.isolated.slug) ? nameOf(view.isolated) : null;
  const networkName = view.network && catalog?.structure(view.network.slug) ? nameOf(view.network) : null;
  const errors = [error, failedKinds.length ? (pwa.online ? S.failed : S.failedOffline)(failedKinds.join(', ')) : null].filter((x): x is string => !!x);

  return (
    <div className={`app${narrow ? ' is-narrow' : ''}`}>
      <UpdateBanner visible={pwa.updateReady} onReload={pwa.applyUpdate} onLater={() => { pwa.dismissUpdate(); focusHome(); }} />
      <main className="stage">
        <canvas ref={canvasRef} className="canvas" tabIndex={0} role="img" aria-label={S.canvasLabel} aria-describedby="canvas-help" />
        <p id="canvas-help" className="visually-hidden">{S.canvasHelp}</p>
      </main>

      {narrow ? (
        <header className="header">
          {searchOpen && index ? (
            <>
              <Search index={index} lang={view.lang} onSelect={pick} autoFocus suggestions={tryThese} />
              <button type="button" className="btn ghost icon" aria-label={S.closeSearch} onClick={() => { setSearchOpen(false); requestAnimationFrame(() => searchButton.current?.focus()); }}><X aria-hidden="true" size={20} /></button>
            </>
          ) : (
            <>
              <h1>{S.appTitle}</h1>
              {offlineTag}
              <button ref={searchButton} type="button" className="btn ghost icon" aria-label={S.openSearch} onClick={() => setSearchOpen(true)} disabled={!index}><SearchIcon aria-hidden="true" size={20} /></button>
              <MoreMenu entries={menu} />
            </>
          )}
        </header>
      ) : (
        <header className="header">
          <button ref={drawerToggle} type="button" className="btn ghost" aria-expanded={drawerOpen} aria-controls="drawer" onClick={toggleDrawer}><Menu aria-hidden="true" size={20} />{S.structures}</button>
          <h1>{S.appTitle}</h1>
          <div className="header-search">{index && <Search index={index} lang={view.lang} onSelect={pick} suggestions={tryThese} />}</div>
          <div role="group" aria-label={S.modelLabel} className="segmented">
            {(['male', 'female'] as Model[]).map((m) => (
              <button key={m} type="button" className="btn" aria-pressed={view.model === m} aria-busy={switchTarget === m || undefined} disabled={!ready || switching} onClick={() => toModel(m)}>{S.models[m]}</button>
            ))}
          </div>
          <span className="lang-label muted" aria-hidden="true">{S.namesIn}</span>
          <div role="group" aria-label={S.namesLabel} title={S.namesLabel} className="segmented lang">
            {LANGS.map((l) => (
              // visible FR / EN / LA, spelt out for screen readers; the name still starts with the visible text
              <button key={l} type="button" className="btn" aria-pressed={view.lang === l} title={S.langs[l]} onClick={() => viewer?.setState({ lang: l })}>
                {S.langShort[l]}<span className="visually-hidden"> ({S.langs[l].toLowerCase()})</span>
              </button>
            ))}
          </div>
          {offlineTag}
          <MoreMenu entries={menu} />
        </header>
      )}

      <div className="top-overlays">
        {ready && <Welcome touch={narrow || matchMedia('(pointer: coarse)').matches} onDone={focusHome} />}
        {view.model === 'female' && <FemaleNotice atlas={atlas} onDone={focusHome} />}
        <Notifications loading={switchTarget ? S.switchingTo(switchTarget) : loading ? S.loading(loading.loaded, loading.total) : null}
          progress={loading && loading.total ? loading : null} errors={errors} onDone={focusHome} />
        {viewer && <Banners viewer={viewer} isolatedName={isolatedName} networkName={networkName} hiddenCount={view.hidden.length} onDone={focusHome} />}
      </div>

      {!narrow && drawerOpen && (
        <nav id="drawer" className="drawer surface" aria-label={S.treeLabel}>
          <div className="drawer-head">
            <h2>{S.structures}</h2>
            <button type="button" className="btn ghost icon" aria-label={S.closeDrawer} onClick={() => { toggleDrawer(); requestAnimationFrame(() => drawerToggle.current?.focus()); }}><ChevronLeft aria-hidden="true" size={18} /></button>
          </div>
          {tree}
        </nav>
      )}
      {!narrow && card && <aside className="card surface" aria-labelledby="panel-name">{card}</aside>}
      {!narrow && tool && (
        <section id="tool-panel" className={`tool-panel surface tool-${tool}`} aria-labelledby="tool-panel-title">
          <div className="tool-panel-head">
            <h2 id="tool-panel-title">{S.toolNames[tool]}</h2>
            <button type="button" className="btn ghost icon small" aria-label={S.closeTool(S.toolNames[tool])} onClick={closeTool}><X aria-hidden="true" size={18} /></button>
          </div>
          {toolContent(tool)}
        </section>
      )}
      {!narrow && catalog && (
        <nav className="toolbar surface" aria-label={S.toolsLabel}>
          {TOOLS.map((t) => (
            <ToolButton key={t} ref={(el) => { toolButtons.current[t] = el; }} tool={t} open={tool === t} modified={toolModified(t, view)}
              controls="tool-panel" onClick={() => toggleTool(t)} />
          ))}
        </nav>
      )}
      {viewer && ready && <CameraGroup viewer={viewer} narrow={narrow} compact={compact} />}

      {narrow && (
        <Sheet height={sheet} onHeight={setSheet} header={
          <div className="sheet-summary">
            {view.selection && catalog ? (
              <>
                <span className="sheet-name">{nameOf(view.selection)}</span>
                {selectionJoint && <button type="button" className="btn icon" aria-label={S.animate} onClick={animate}><Play aria-hidden="true" size={18} /></button>}
              </>
            ) : <span className="muted">{S.tapStructure}</span>}
          </div>
        }>
          <Tabs current={tab} onChange={setTab} panels={{
            info: card || <p className="muted">{S.panelEmpty}</p>,
            tree,
            tools: (
              <>
                <div role="group" aria-label={S.toolChoice} className="segmented wide">
                  {TOOLS.map((t) => <button key={t} type="button" className="btn" aria-pressed={phoneTool === t} onClick={() => setPhoneTool(t)}>{S.toolNames[t]}</button>)}
                </div>
                <section className={`phone-tool tool-${phoneTool}`} aria-label={S.toolNames[phoneTool]}>{toolContent(phoneTool)}</section>
              </>
            ),
          }} />
        </Sheet>
      )}

      <HoverLabel canvas={canvasRef.current} hover={hover} nameOf={nameOf} />
      <div role="status" aria-live="polite" className="visually-hidden" data-testid="announce">
        {notice ?? (view.selection ? S.selected(nameOf(view.selection)) : ready ? S.cleared : '')}
      </div>
      {viewer && ready && new URLSearchParams(location.search).has('bench') && <Bench viewer={viewer} />}
      <CreditsDialog open={creditsOpen} atlas={atlas} onClose={() => setCreditsOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} backend={snapshot.backend} />
      <OfflineDialog open={offlineOpen} onClose={() => setOfflineOpen(false)}
        supported={pwa.supported} canInstall={pwa.canInstall} install={pwa.install} iosHint={pwa.iosHint} model={view.model} atlas={atlas} />
    </div>
  );
}
