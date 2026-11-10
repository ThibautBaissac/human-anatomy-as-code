// Changes to the isolation and the hidden structures, as view patches. Pure.
import { selectionKey, type Catalog } from './catalog.ts';
import type { ViewState } from './types.ts';

/** Hides the selection: its key goes last (the next undo), the selection is cleared, and isolating it ends. */
export function hideSelection(v: ViewState): Partial<ViewState> {
  if (!v.selection) return {};
  const key = selectionKey(v.selection);
  const isolated = v.isolated && selectionKey(v.isolated) === key ? null : v.isolated;
  return { hidden: [...v.hidden.filter((k) => k !== key), key], selection: null, isolated };
}

/** Shows the last hidden structure again. */
export function undoHide(v: ViewState): Partial<ViewState> {
  return v.hidden.length ? { hidden: v.hidden.slice(0, -1) } : {};
}

/** After a model switch: an isolation or hidden keys with no instance in the model are dropped (nothing to show or count). */
export function keepKnown(v: ViewState, catalog: Pick<Catalog, 'instancesOf' | 'instancesOfKeys'>): Partial<ViewState> {
  const patch: Partial<ViewState> = {};
  if (v.isolated && !catalog.instancesOf(v.isolated.slug, v.isolated.side).length) patch.isolated = null;
  const hidden = v.hidden.filter((k) => catalog.instancesOfKeys([k]).size > 0);
  if (hidden.length !== v.hidden.length) patch.hidden = hidden;
  return patch;
}
