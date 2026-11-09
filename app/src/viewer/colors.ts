// Display colour per kind and of the selection highlight (spec "Global constraints"). Pure.
export const KIND_COLORS: Record<string, string> = {
  bone: '#e8dcc0', cartilage: '#9ec9d6', ligament: '#d8d0a0', muscle: '#b5443b', tendon: '#e0d6c8',
  fascia: '#c9b8a8', skin: '#e8b89a', artery: '#d0302a', vein: '#3456b0', lymphatic: '#7fbf7f',
  nerve: '#f0d040', joint: '#a8b8d8', cns: '#e8c8a0', organ: '#c58a7a',
};
export const HIGHLIGHT = '#3ad06a';
/** Colour of a kind; files of the female model are named female-<kind>. */
export const colorOf = (kind: string) => KIND_COLORS[kind.replace(/^female-/, '')] ?? KIND_COLORS.organ;
