// What an instance looks like for a given view. The renderer only applies this. Pure.
export interface AppearanceState {
  hiddenKinds: ReadonlySet<string>;
  /** Layers strictly shallower than this are removed (0 removes nothing). */
  layerCut: number;
  ghost: boolean;
  /** Instance indices of the current selection. */
  selected: ReadonlySet<number>;
  /** Hidden systems: an instance goes when all its systems are hidden; one without system is not affected. */
  hiddenSystems?: ReadonlySet<string>;
  /** Instance indices of soft tissues crossing a moving joint: ghosted, their rigid shape would be wrong. */
  crossing?: ReadonlySet<number>;
  /** Instance indices of the structures the user hid. */
  hidden?: ReadonlySet<number>;
  /** Instance indices of the isolated structure: shown opaque, every other one ghosted. Empty or absent: no isolation. */
  isolated?: ReadonlySet<number>;
  /** Instance indices under the pointer. */
  hovered?: ReadonlySet<number>;
}

export interface Appearance {
  visible: boolean;
  alpha: number;
  highlighted: boolean;
  hovered: boolean;
}

export const GHOST_ALPHA = 0.15;

const HIDDEN: Appearance = { visible: false, alpha: 1, highlighted: false, hovered: false };

export function appearance(state: AppearanceState, inst: InstanceLike): Appearance {
  const a = baseAppearance(state, inst);
  if (!a.visible) return a;
  let alpha = a.alpha;
  const isolating = !!state.isolated?.size;
  if (isolating && !a.highlighted && !state.isolated!.has(inst.index)) alpha = Math.min(alpha, GHOST_ALPHA);
  if (state.crossing?.has(inst.index)) alpha = Math.min(alpha, GHOST_ALPHA);
  const hovered = alpha === 1 && !a.highlighted && !!state.hovered?.has(inst.index);
  return { ...a, alpha, hovered };
}

type InstanceLike = { index: number; kind: string; layer: number; systems?: string[]; inModel?: boolean };

function baseAppearance(state: AppearanceState, inst: InstanceLike): Appearance {
  if (inst.inModel === false) return HIDDEN;
  if (state.selected.has(inst.index)) return { visible: true, alpha: 1, highlighted: true, hovered: false };
  if (state.hidden?.has(inst.index)) return HIDDEN;
  if (state.isolated?.has(inst.index)) return { visible: true, alpha: 1, highlighted: false, hovered: false };
  if (state.hiddenKinds.has(inst.kind)) return HIDDEN;
  if (inst.systems?.length && state.hiddenSystems && inst.systems.every((x) => state.hiddenSystems!.has(x))) return HIDDEN;
  if (inst.layer < state.layerCut) return state.ghost ? { visible: true, alpha: GHOST_ALPHA, highlighted: false, hovered: false } : HIDDEN;
  return { visible: true, alpha: 1, highlighted: false, hovered: false };
}
