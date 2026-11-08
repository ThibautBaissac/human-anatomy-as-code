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
