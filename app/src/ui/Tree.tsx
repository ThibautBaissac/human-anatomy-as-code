import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Eye, EyeOff } from 'lucide-react';
import type { Catalog } from '../viewer/catalog.ts';
import { UNATTACHED, ROOT } from '../viewer/catalog.ts';
import { labelText, labelLang, normalize } from '../viewer/search.ts';
import type { Lang, Selection } from '../viewer/types.ts';
import { filterTree, flattenTree, sortedTree, treeKeyReducer, type TreeState } from './tree-model.ts';
import { S } from './strings.ts';

const ROW = 30;
const rowId = (id: string) => `tree-${id}`;

/** Memoised: re-renders only when its props change (not on every frame of a joint playback). */
export const Tree = memo(TreeView);

/**
 * Structures tree: sorted by the names shown, a filter on top, a mark on names shown in another language
 * than the one chosen, and an eye to hide or show a branch (a mouse shortcut for Masquer on the card).
 */
function TreeView({ catalog, lang, selection, hidden, onSelect, onHidden }: {
  catalog: Catalog; lang: Lang; selection: Selection | null; hidden: readonly string[];
  onSelect: (slug: string) => void; onHidden: (slug: string, on: boolean) => void;
}) {
  const id = useId();
  const [state, setState] = useState<TreeState>({ expanded: new Set([ROOT]), focused: ROOT });
  const [query, setQuery] = useState('');
  const name = (x: string) => (x === UNATTACHED ? S.unattached : labelText(catalog.structure(x) ?? { slug: x, labels: {} }, lang));
  const sorted = useMemo(() => sortedTree(catalog, name, lang), [catalog, lang]);
  const filtered = useMemo(() => filterTree(sorted, name, query, normalize), [sorted, query]);
  const source = filtered?.tree ?? sorted;
  const rows = useMemo(() => flattenTree(source, state.expanded), [source, state.expanded]);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW, overscan: 12 });

  // A filter opens what leads to its matches; clearing it gives the tree back as it was.
  const before = useRef<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (filtered) {
      before.current ??= state.expanded;
      const first = flattenTree(filtered.tree, filtered.expanded)[0]?.id ?? ROOT;
      setState({ expanded: filtered.expanded, focused: first });
    } else if (before.current) {
      const expanded = before.current;
      before.current = null;
      setState((s) => ({ expanded, focused: s.focused }));
    }
  }, [filtered]);

  // A selection made elsewhere (3D, search) opens its ancestors and scrolls to it.
  useEffect(() => {
    if (!selection || filtered) return;
    setState((s) => ({ expanded: new Set([...s.expanded, ...catalog.ancestorsOf(selection.slug)]), focused: selection.slug }));
  }, [selection, catalog]);
  useEffect(() => {
    const i = rows.findIndex((r) => r.id === state.focused);
    if (i >= 0) virtualizer.scrollToIndex(i, { align: 'auto' });
  }, [state.focused, rows, virtualizer]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = treeKeyReducer(source, state, e.key);
    if (next === state) return;
    e.preventDefault();
    if (next.selected && next.selected !== UNATTACHED) onSelect(next.selected);
    const { selected: _, ...rest } = next;
    setState(rest);
  };
  const toggle = (x: string) => setState((s) => {
    const expanded = new Set(s.expanded);
    if (expanded.has(x)) expanded.delete(x); else expanded.add(x);
    return { expanded, focused: x };
  });

  return (
    <div className="tree-wrap">
      <div className="tree-filter">
        <label htmlFor={`${id}-filter`} className="visually-hidden">{S.treeFilter}</label>
        <input id={`${id}-filter`} type="search" className="field" placeholder={S.treeFilterPlaceholder} value={query} autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery(''); } }} />
        <div role="status" className="visually-hidden">{filtered ? S.treeMatches(filtered.matches) : ''}</div>
      </div>
      {filtered && filtered.matches === 0 ? <p className="muted small tree-empty">{S.treeNoMatch}</p> : (
        <div ref={scrollRef} className="tree-scroll">
          <div
            role="tree"
            aria-label={S.treeLabel}
            tabIndex={0}
            aria-activedescendant={rows.some((r) => r.id === state.focused) ? rowId(state.focused) : undefined}
            onKeyDown={onKeyDown}
            className="tree"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const r = rows[v.index];
              const selected = selection?.slug === r.id;
              const s = r.id === UNATTACHED ? undefined : catalog.structure(r.id);
              const shownLang = s ? labelLang(s, lang) : undefined;
              const fallback = !!s && shownLang !== lang;
              const isHidden = hiddenSet.has(r.id);
              return (
                <div
                  key={r.id}
                  id={rowId(r.id)}
                  role="treeitem"
                  aria-level={r.level}
                  aria-setsize={r.setsize}
                  aria-posinset={r.posinset}
                  aria-expanded={r.expandable ? r.expanded : undefined}
                  aria-selected={selected}
                  className={`tree-row${selected ? ' is-selected' : ''}${state.focused === r.id ? ' is-focused' : ''}${isHidden ? ' is-hidden' : ''}`}
                  style={{ transform: `translateY(${v.start}px)`, paddingInlineStart: `${(r.level - 1) * 14 + 4}px` }}
                  onClick={() => { setState((x) => ({ ...x, focused: r.id })); if (r.id !== UNATTACHED) onSelect(r.id); }}
                >
                  <span className="twisty" aria-hidden="true" onClick={(e) => { e.stopPropagation(); if (r.expandable) toggle(r.id); }}>
                    {r.expandable ? (r.expanded ? '▾' : '▸') : ''}
                  </span>
                  <span className="tree-name" lang={shownLang}>{name(r.id)}</span>
                  {fallback && shownLang && <span className="lang-badge" aria-hidden="true" title={S.fallbackTitle(S.langs[shownLang])}>{S.langShort[shownLang] ?? shownLang}</span>}
                  {/* mouse shortcut: from the keyboard, select the structure then Masquer on the card */}
                  {s && (
                    <span className="eye" aria-hidden="true" title={isHidden ? S.showStructure : S.hide}
                      onClick={(e) => { e.stopPropagation(); onHidden(r.id, !isHidden); }}>
                      {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
