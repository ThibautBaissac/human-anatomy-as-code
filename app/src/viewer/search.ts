// Name search across fr/en/la labels, synonyms and slugs. Pure.
import type { Atlas, AtlasStructure, Lang } from './types.ts';

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

const nameIn = (names: Partial<Record<Lang, string>> | undefined, slug: string, lang: Lang) =>
  names?.[lang] ?? names?.fr ?? names?.en ?? slug;

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
    slug: s.slug, name: nameIn(index.names.get(s.slug), s.slug, lang), matchedLang: s.term.lang, matchedText: s.term.text,
  }));
}
