import type { Label, Lang, Side } from './types.ts';

// Side qualifier by [side][gender][number]; English is handled separately (prefix).
const FR: Record<Side, Record<'m' | 'f', Record<'sg' | 'pl', string>>> = {
  left: { m: { sg: 'gauche', pl: 'gauches' }, f: { sg: 'gauche', pl: 'gauches' } },
  right: { m: { sg: 'droit', pl: 'droits' }, f: { sg: 'droite', pl: 'droites' } },
};
const LA: Record<Side, Record<'m' | 'f' | 'n', Record<'sg' | 'pl', string>>> = {
  left: {
    m: { sg: 'sinister', pl: 'sinistri' },
    f: { sg: 'sinistra', pl: 'sinistrae' },
    n: { sg: 'sinistrum', pl: 'sinistra' },
  },
  right: {
    m: { sg: 'dexter', pl: 'dextri' },
    f: { sg: 'dextra', pl: 'dextrae' },
    n: { sg: 'dextrum', pl: 'dextra' },
  },
};

/** Lateralised name of a canonical label. Missing gender falls back to masculine singular. */
export function composeSideLabel(label: Label, lang: Lang, side: Side): string {
  if (lang === 'en') return `${side} ${label.text}`;
  const number = label.gender ? (label.number ?? 'sg') : 'sg';
  if (lang === 'fr') {
    const gender = label.gender === 'f' ? 'f' : 'm';
    return `${label.text} ${FR[side][gender][number]}`;
  }
  const gender = label.gender ?? 'm';
  return `${label.text} ${LA[side][gender][number]}`;
}
