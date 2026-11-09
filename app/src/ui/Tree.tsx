import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Catalog } from '../viewer/catalog.ts';
import { UNATTACHED, ROOT } from '../viewer/catalog.ts';
import { labelText } from '../viewer/search.ts';
import type { Lang, Selection } from '../viewer/types.ts';
import { flattenTree, treeKeyReducer, type TreeState } from './tree-model.ts';
import { S } from './strings.ts';

const ROW = 28;
const rowId = (id: string) => `tree-${id}`;

/** Memoised: re-renders only when its props change (not on every frame of a joint playback). */
export const Tree = memo(TreeView);

function TreeView({ catalog, lang, selection, onSelect }: { catalog: Catalog; lang: Lang; selection: Selection | null; onSelect: (slug: string) => void }) {
  const [state, setState] = useState<TreeState>({ expanded: new Set([ROOT]), focused: ROOT });
  const rows = useMemo(() => flattenTree(catalog, state.expanded), [catalog, state.expanded]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW, overscan: 12 });
  const name = (id: string) => (id === UNATTACHED ? S.unattached : labelText(catalog.structure(id) ?? { slug: id, labels: {} }, lang));

  // A selection made elsewhere (3D, search) opens its ancestors and scrolls to it.
  useEffect(() => {
    if (!selection) return;
    setState((s) => ({ expanded: new Set([...s.expanded, ...catalog.ancestorsOf(selection.slug)]), focused: selection.slug }));
  }, [selection, catalog]);
  useEffect(() => {
    const i = rows.findIndex((r) => r.id === state.focused);
    if (i >= 0) virtualizer.scrollToIndex(i, { align: 'auto' });
  }, [state.focused, rows, virtualizer]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = treeKeyReducer(catalog, state, e.key);
    if (next === state) return;
    e.preventDefault();
    if (next.selected && next.selected !== UNATTACHED) onSelect(next.selected);
    const { selected: _, ...rest } = next;
    setState(rest);
  };
  const toggle = (id: string) => setState((s) => {
    const expanded = new Set(s.expanded);
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    return { expanded, focused: id };
  });

  return (
    <div ref={scrollRef} className="tree-scroll">
      <div
        role="tree"
        aria-label={S.treeLabel}
        tabIndex={0}
        aria-activedescendant={rowId(state.focused)}
        onKeyDown={onKeyDown}
        className="tree"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((v) => {
          const r = rows[v.index];
          const selected = selection?.slug === r.id;
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
              className={`tree-row${selected ? ' is-selected' : ''}${state.focused === r.id ? ' is-focused' : ''}`}
              style={{ transform: `translateY(${v.start}px)`, paddingInlineStart: `${(r.level - 1) * 14 + 4}px` }}
              onClick={() => { setState((s) => ({ ...s, focused: r.id })); if (r.id !== UNATTACHED) onSelect(r.id); }}
            >
              <span className="twisty" aria-hidden="true" onClick={(e) => { e.stopPropagation(); if (r.expandable) toggle(r.id); }}>
                {r.expandable ? (r.expanded ? '▾' : '▸') : ''}
              </span>
              {name(r.id)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
