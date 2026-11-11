// Display colour per kind and of the selection highlight (spec "Global constraints"). Pure.
export const KIND_COLORS: Record<string, string> = {
  bone: '#e8dcc0', cartilage: '#9ec9d6', ligament: '#d8d0a0', muscle: '#b5443b', tendon: '#e0d6c8',
  fascia: '#c9b8a8', skin: '#e8b89a', artery: '#d0302a', vein: '#3456b0', lymphatic: '#7fbf7f',
  nerve: '#f0d040', joint: '#a8b8d8', cns: '#e8c8a0', organ: '#c58a7a',
};
export const HIGHLIGHT = '#3ad06a';
/** Colour of a kind; files of the female model are named female-<kind>. */
export const colorOf = (kind: string) => KIND_COLORS[kind.replace(/^female-/, '')] ?? KIND_COLORS.organ;

/** Surface roughness per kind: matte bone and fascia, moist muscles and organs, glossy vessels. */
export const KIND_ROUGHNESS: Record<string, number> = {
  bone: 0.72, cartilage: 0.42, ligament: 0.55, muscle: 0.5, tendon: 0.45, fascia: 0.62, skin: 0.62, artery: 0.32,
  vein: 0.32, lymphatic: 0.4, nerve: 0.45, joint: 0.5, cns: 0.58, organ: 0.42,
};
/** Roughness of a kind (female-<kind> files share their kind's). */
export const roughnessOf = (kind: string) => KIND_ROUGHNESS[kind.replace(/^female-/, '')] ?? KIND_ROUGHNESS.organ;
