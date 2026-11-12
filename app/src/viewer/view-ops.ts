// Changes to the isolation and the hidden structures, as view patches. Pure.
import { selectionKey, type Catalog } from './catalog.ts';
import type { ViewState } from './types.ts';

/** Hides the selection: its key goes last (the next undo), the selection is cleared, and isolating it ends. */
export function hideSelection(v: ViewState): Partial<ViewState> {
  if (!v.selection) return {};
  const key = selectionKey(v.selection);
  const isolated = v.isolated && selectionKey(v.isolated) === key ? null : v.isolated;
  const patch: Partial<ViewState> = { hidden: [...v.hidden.filter((k) => k !== key), key], selection: null, isolated };
  if (v.network && selectionKey(v.network) === key) patch.network = null;
  return patch;
}

/**
 * Hides or shows one structure (key slug or slug@side) from the tree. Hiding it clears it from the selection and the
 * isolation, like Masquer; showing it removes the key wherever it stands in the undo order.
 */
export function setHidden(v: ViewState, key: string, on: boolean): Partial<ViewState> {
  const shown = v.hidden.filter((k) => k !== key);
  if (!on) return shown.length === v.hidden.length ? {} : { hidden: shown };
  const patch: Partial<ViewState> = { hidden: [...shown, key] };
  if (v.selection && selectionKey(v.selection) === key) patch.selection = null;
  if (v.isolated && selectionKey(v.isolated) === key) patch.isolated = null;
  if (v.network && selectionKey(v.network) === key) patch.network = null;
  return patch;
}

/**
 * Hides every system but the skeleton (Calques → Tout masquer): the systems of the model other than `skeletal`
 * are hidden, and the bones show again if their kind was hidden.
 */
export function skeletonOnly(v: ViewState, systems: readonly string[]): Partial<ViewState> {
  return { hiddenSystems: systems.filter((x) => x !== 'skeletal').sort(), hiddenKinds: v.hiddenKinds.filter((k) => k !== 'bone') };
}

/** Whether the view already shows the skeleton alone (Tout masquer has nothing left to do). */
export function isSkeletonOnly(v: ViewState, systems: readonly string[]): boolean {
  const others = systems.filter((x) => x !== 'skeletal');
  return !v.hiddenKinds.includes('bone') && !v.hiddenSystems.includes('skeletal') && others.every((x) => v.hiddenSystems.includes(x));
}

/** Shows the last hidden structure again. */
export function undoHide(v: ViewState): Partial<ViewState> {
  return v.hidden.length ? { hidden: v.hidden.slice(0, -1) } : {};
}

/** After a model switch: an isolation or hidden keys with no instance in the model are dropped (nothing to show or count). */
export function keepKnown(v: ViewState, catalog: Pick<Catalog, 'instancesOf' | 'instancesOfKeys'>): Partial<ViewState> {
  const patch: Partial<ViewState> = {};
  if (v.isolated && !catalog.instancesOf(v.isolated.slug, v.isolated.side).length) patch.isolated = null;
  if (v.network && !catalog.instancesOf(v.network.slug, v.network.side).length) patch.network = null;
  const hidden = v.hidden.filter((k) => catalog.instancesOfKeys([k]).size > 0);
  if (hidden.length !== v.hidden.length) patch.hidden = hidden;
  return patch;
}
