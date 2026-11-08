import { useId, useMemo, useState } from 'react';
import { search, type SearchIndex, type SearchResult } from '../viewer/search.ts';
import type { Lang } from '../viewer/types.ts';
import { S } from './strings.ts';

const LANG_NAME: Record<string, string> = { fr: 'fr', en: 'en', la: 'la', slug: 'identifiant' };

/** ARIA APG combobox with a listbox popup. */
export function Search({ index, lang, onSelect }: { index: SearchIndex; lang: Lang; onSelect: (slug: string) => void }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results: SearchResult[] = useMemo(() => search(index, query, lang), [index, query, lang]);
  const expanded = open && results.length > 0;

  const choose = (r: SearchResult | undefined) => {
    if (!r) return;
    onSelect(r.slug);
    setQuery(r.name);
    setOpen(false);
    setActive(-1);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active >= 0 ? active : 0]); }
    else if (e.key === 'Escape') { if (open) setOpen(false); else setQuery(''); setActive(-1); }
  };

  return (
    <div className="search">
      <label htmlFor={`${id}-input`}>{S.searchLabel}</label>
      <input
        id={`${id}-input`}
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
        placeholder={S.searchPlaceholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <ul id={`${id}-list`} role="listbox" aria-label={S.searchLabel} className="search-list" hidden={!expanded}>
        {results.map((r, i) => (
          <li
            key={r.slug}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'is-active' : undefined}
            onMouseDown={(e) => { e.preventDefault(); choose(r); }}
          >
            {r.name}
            {r.matchedText !== r.name && <span className="match"> — {LANG_NAME[r.matchedLang]} : {r.matchedText}</span>}
          </li>
        ))}
      </ul>
      <div role="status" className="visually-hidden">{query.trim().length >= 2 ? S.searchResults(results.length) : ''}</div>
    </div>
  );
}
