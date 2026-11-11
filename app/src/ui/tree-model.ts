// Tree view model and keyboard navigation (ARIA APG Tree View pattern). Pure.
export interface TreeSource {
  roots: string[];
  childrenOf(id: string): string[];
  parentOf(id: string): string | null;
}

export interface TreeRow {
  id: string;
  level: number;
  posinset: number;
  setsize: number;
  expandable: boolean;
  expanded: boolean;
}

export interface TreeState {
  expanded: ReadonlySet<string>;
  focused: string;
  /** set when the key asks to select the focused row */
  selected?: string;
}

/** The same tree, children sorted by the name they show (in that language's collation). */
export function sortedTree(tree: TreeSource, nameOf: (id: string) => string, locale: string): TreeSource {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  const cache = new Map<string, string[]>();
  return {
    roots: tree.roots,
    parentOf: (id) => tree.parentOf(id),
    childrenOf(id) {
      let kids = cache.get(id);
      if (!kids) { kids = [...tree.childrenOf(id)].sort((a, b) => collator.compare(nameOf(a), nameOf(b))); cache.set(id, kids); }
      return kids;
    },
  };
}

/**
 * The rows a filter keeps: every node whose name contains the query (accents and case ignored), with its ancestors,
 * which open so the matches show. Null under two characters (no filter).
 */
export function filterTree(tree: TreeSource, nameOf: (id: string) => string, query: string, norm: (s: string) => string): { tree: TreeSource; expanded: Set<string>; matches: number } | null {
  const q = norm(query);
  if (q.length < 2) return null;
  const keep = new Set<string>(), expanded = new Set<string>();
  let matches = 0;
  const walk = (id: string, path: string[]): boolean => {
    let hit = false;
    for (const c of tree.childrenOf(id)) if (walk(c, [...path, id])) hit = true;
    if (norm(nameOf(id)).includes(q)) { matches++; hit = true; }
    if (hit) { keep.add(id); for (const p of path) expanded.add(p); }
    return hit;
  };
  for (const r of tree.roots) walk(r, []);
  // a kept node whose descendants matched is open as well
  for (const id of keep) if (tree.childrenOf(id).some((c) => keep.has(c))) expanded.add(id);
  return {
    tree: { roots: tree.roots.filter((r) => keep.has(r)), parentOf: tree.parentOf, childrenOf: (id) => tree.childrenOf(id).filter((c) => keep.has(c)) },
    expanded,
    matches,
  };
}

export function flattenTree(tree: TreeSource, expanded: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (ids: string[], level: number) => {
    ids.forEach((id, i) => {
      const kids = tree.childrenOf(id);
      const isOpen = kids.length > 0 && expanded.has(id);
      rows.push({ id, level, posinset: i + 1, setsize: ids.length, expandable: kids.length > 0, expanded: isOpen });
      if (isOpen) walk(kids, level + 1);
    });
  };
  walk(tree.roots, 1);
  return rows;
}

export function treeKeyReducer(tree: TreeSource, state: TreeState, key: string): TreeState {
  const { selected: _, ...base } = state;
  const rows = flattenTree(tree, state.expanded);
  const i = rows.findIndex((r) => r.id === state.focused);
  const row = rows[i];
  const focus = (id: string): TreeState => ({ ...base, focused: id });
  const setExpanded = (id: string, open: boolean): TreeState => {
    const next = new Set(state.expanded);
    if (open) next.add(id); else next.delete(id);
    return { ...base, expanded: next };
  };
  if (!row) return rows.length ? focus(rows[0].id) : state;
  switch (key) {
    case 'ArrowDown': return focus(rows[Math.min(i + 1, rows.length - 1)].id);
    case 'ArrowUp': return focus(rows[Math.max(i - 1, 0)].id);
    case 'Home': return focus(rows[0].id);
    case 'End': return focus(rows[rows.length - 1].id);
    case 'ArrowRight':
      if (!row.expandable) return state;
      return row.expanded ? focus(tree.childrenOf(row.id)[0]) : setExpanded(row.id, true);
    case 'ArrowLeft': {
      if (row.expanded) return setExpanded(row.id, false);
      const parent = tree.parentOf(row.id);
      return parent && rows.some((r) => r.id === parent) ? focus(parent) : state;
    }
    case 'Enter':
    case ' ':
      return { ...base, selected: row.id };
    default:
      return state;
  }
}
