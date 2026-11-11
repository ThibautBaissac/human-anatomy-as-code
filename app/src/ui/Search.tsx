import { useId, useMemo, useState } from 'react';
import { search, type SearchIndex, type SearchResult } from '../viewer/search.ts';
import type { Lang } from '../viewer/types.ts';
import { Search as SearchIcon } from 'lucide-react';
import { S } from './strings.ts';


/** ARIA APG combobox with a listbox popup. Empty, a click or ↓ lists a few structures to try. */
export function Search({ index, lang, onSelect, autoFocus = false, suggestions = [] }: { index: SearchIndex; lang: Lang; onSelect: (slug: string) => void; autoFocus?: boolean; suggestions?: SearchResult[] }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const found: SearchResult[] = useMemo(() => search(index, query, lang), [index, query, lang]);
  const suggesting = query.trim() === '';
  const results = suggesting ? suggestions : found;
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
    // handled here, so that the page-wide Échap (tool panel) does not also act
    else if (e.key === 'Escape') { if (expanded) { e.preventDefault(); setOpen(false); } else if (query) { e.preventDefault(); setQuery(''); } setActive(-1); }
  };

  return (
    <div className="search">
      <label htmlFor={`${id}-input`} className="visually-hidden">{S.searchLabel}</label>
      <SearchIcon className="search-icon" aria-hidden="true" size={18} />
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-activedescendant={expanded && active >= 0 ? `${id}-opt-${active}` : undefined}
        placeholder={S.searchPlaceholder}
        autoFocus={autoFocus}
        className="field"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <ul id={`${id}-list`} role="listbox" aria-label={suggesting ? S.suggestionsLabel : S.searchLabel} className="search-list" hidden={!expanded}>
        {suggesting && <li role="none" aria-hidden="true" className="search-list-head">{S.suggestionsLabel}</li>}
        {results.map((r, i) => (
          <li
            key={r.slug}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            className={i === active ? 'is-active' : undefined}
            onMouseDown={(e) => { e.preventDefault(); choose(r); }}
          >
            <span lang={r.nameLang}>{r.name}</span>
            {!suggesting && <span className="match"> — {r.matchedLang === 'slug' ? S.matchSlug : S.langs[r.matchedLang]}{r.matchedText !== r.name && <> : <span lang={r.matchedLang === 'slug' ? undefined : r.matchedLang}>{r.matchedText}</span></>}</span>}
          </li>
        ))}
      </ul>
      <div role="status" className="visually-hidden">{query.trim().length >= 2 ? S.searchResults(results.length) : ''}</div>
    </div>
  );
}
