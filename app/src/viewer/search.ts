// Name search across fr/en/la labels, synonyms and slugs. Pure.
import type { Atlas, AtlasStructure, Lang, Side } from './types.ts';

export type MatchLang = Lang | 'slug';

export interface SearchIndex {
  entries: { slug: string; terms: { norm: string; lang: MatchLang; text: string }[] }[];
  /** slug → label text per language, for display */
  names: Map<string, Partial<Record<Lang, string>>>;
}

export interface SearchResult {
  slug: string;
  name: string;
  matchedLang: MatchLang;
  matchedText: string;
  /** language of `name` (for the lang attribute), none when it falls back to the slug */
  nameLang?: Lang;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-\s]+/g, ' ')
    .trim();
}

/** Label in the requested language, else fr, else en, else the slug. */
export function labelText(s: Pick<AtlasStructure, 'slug' | 'labels'>, lang: Lang): string {
  return s.labels[lang]?.text ?? s.labels.fr?.text ?? s.labels.en?.text ?? s.slug;
}

/** Display name of a structure, or of one of its sides: requested language, else fr, else en. */
export function structureName(s: Pick<AtlasStructure, 'slug' | 'labels' | 'sides'>, side: Side | null, lang: Lang): string {
  const names = side ? s.sides?.[side]?.labels : undefined;
  return (names && (names[lang] ?? names.fr ?? names.en)) || labelText(s, lang);
}

const nameIn = (names: Partial<Record<Lang, string>> | undefined, slug: string, lang: Lang) =>
  names?.[lang] ?? names?.fr ?? names?.en ?? slug;
/** Language of the text nameIn / labelText return, by the same fallback; undefined for the slug. */
const langIn = (names: Partial<Record<Lang, unknown>> | undefined, lang: Lang): Lang | undefined =>
  names?.[lang] ? lang : names?.fr ? 'fr' : names?.en ? 'en' : undefined;
export const labelLang = (s: Pick<AtlasStructure, 'labels'>, lang: Lang): Lang | undefined => langIn(s.labels, lang);
/** Language of the text structureName returns. */
export function structureNameLang(s: Pick<AtlasStructure, 'labels' | 'sides'>, side: Side | null, lang: Lang): Lang | undefined {
  const names = side ? s.sides?.[side]?.labels : undefined;
  return langIn(names, lang) ?? labelLang(s, lang);
}

export function buildSearchIndex(atlas: Atlas): SearchIndex {
  const names = new Map<string, Partial<Record<Lang, string>>>();
  const entries = atlas.structures.map((s) => {
    const terms: SearchIndex['entries'][number]['terms'] = [];
    const display: Partial<Record<Lang, string>> = {};
    for (const lang of ['fr', 'en', 'la'] as const) {
      const l = s.labels[lang];
      if (!l) continue;
      display[lang] = l.text;
      terms.push({ norm: normalize(l.text), lang, text: l.text });
      for (const syn of l.synonyms ?? []) terms.push({ norm: normalize(syn), lang, text: syn });
    }
    terms.push({ norm: normalize(s.slug), lang: 'slug', text: s.slug });
    names.set(s.slug, display);
    return { slug: s.slug, terms };
  });
  return { entries, names };
}

export function search(index: SearchIndex, query: string, lang: Lang, limit = 20): SearchResult[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const scored: { rank: number; length: number; slug: string; term: SearchIndex['entries'][number]['terms'][number] }[] = [];
  for (const e of index.entries) {
    let best: (typeof scored)[number] | undefined;
    for (const t of e.terms) {
      const rank = t.norm === q ? 0 : t.norm.startsWith(q) ? 1 : t.norm.includes(q) ? 2 : -1;
      if (rank < 0) continue;
      const cand = { rank, length: t.norm.length, slug: e.slug, term: t };
      if (!best || cand.rank < best.rank || (cand.rank === best.rank && cand.length < best.length)) best = cand;
    }
    if (best) scored.push(best);
  }
  scored.sort((a, b) => a.rank - b.rank || a.length - b.length || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return scored.slice(0, limit).map((s) => ({
    slug: s.slug, name: nameIn(index.names.get(s.slug), s.slug, lang), nameLang: langIn(index.names.get(s.slug), lang), matchedLang: s.term.lang, matchedText: s.term.text,
  }));
}

/** Structures to try on an empty search, those the model has, by name in the language. */
export function suggestions(index: SearchIndex, slugs: readonly string[], lang: Lang): SearchResult[] {
  return slugs.filter((slug) => index.names.has(slug)).map((slug) => {
    const names = index.names.get(slug);
    const name = nameIn(names, slug, lang);
    return { slug, name, nameLang: langIn(names, lang), matchedLang: lang, matchedText: name };
  });
}
