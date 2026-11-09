// What an instance looks like for a given view. The renderer only applies this. Pure.
export interface AppearanceState {
  hiddenKinds: ReadonlySet<string>;
  /** Layers strictly shallower than this are removed (0 removes nothing). */
  layerCut: number;
  ghost: boolean;
  /** Instance indices of the current selection. */
  selected: ReadonlySet<number>;
  /** Instance indices of soft tissues crossing a moving joint: ghosted, their rigid shape would be wrong. */
  crossing?: ReadonlySet<number>;
}

export interface Appearance {
  visible: boolean;
  alpha: number;
  highlighted: boolean;
}

export const GHOST_ALPHA = 0.15;

export function appearance(state: AppearanceState, inst: { index: number; kind: string; layer: number; inModel?: boolean }): Appearance {
  const a = baseAppearance(state, inst);
  return a.visible && state.crossing?.has(inst.index) ? { ...a, alpha: Math.min(a.alpha, GHOST_ALPHA) } : a;
}

function baseAppearance(state: AppearanceState, inst: { index: number; kind: string; layer: number; inModel?: boolean }): Appearance {
  if (inst.inModel === false) return { visible: false, alpha: 1, highlighted: false };
  if (state.selected.has(inst.index)) return { visible: true, alpha: 1, highlighted: true };
  if (state.hiddenKinds.has(inst.kind)) return { visible: false, alpha: 1, highlighted: false };
  if (inst.layer < state.layerCut) return state.ghost ? { visible: true, alpha: GHOST_ALPHA, highlighted: false } : { visible: false, alpha: 1, highlighted: false };
  return { visible: true, alpha: 1, highlighted: false };
}
