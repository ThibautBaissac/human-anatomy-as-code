import type { Catalog } from '../viewer/catalog.ts';
import { labelText, structureName } from '../viewer/search.ts';
import type { ReactNode } from 'react';
import { LANGS, type Lang, type Selection } from '../viewer/types.ts';
import { S } from './strings.ts';

export function InfoPanel({ catalog, lang, selection, onSelect, children }: { catalog: Catalog | null; lang: Lang; selection: Selection | null; onSelect: (slug: string) => void; children?: ReactNode }) {
  const s = selection && catalog?.structure(selection.slug);
  if (!s || !catalog) return <p className="panel-empty">{S.panelEmpty}</p>;
  const parent = s.parent ? catalog.structure(s.parent) : undefined;
  return (
    <div className="panel">
      <h2 id="panel-name">{structureName(s, selection.side, lang)}</h2>
      <dl className="names">
        {LANGS.map((l) => {
          const label = s.labels[l];
          return (
            <div key={l} lang={l}>
              <dt>{S.langs[l]}</dt>
              <dd>
                {label ? label.text : <span className="muted">{S.noName}</span>}
                {label?.status === 'draft' && <span className="badge" title={S.notReviewedTitle}>{S.notReviewed}</span>}
              </dd>
            </div>
          );
        })}
      </dl>
      <dl className="facts">
        {selection.side && (<div><dt>{S.sideLabel}</dt><dd>{S.side[selection.side]}</dd></div>)}
        <div><dt>{S.kind}</dt><dd>{S.kinds[s.kind] ?? s.kind}</dd></div>
        {s.layer !== null && (<div><dt>{S.layer}</dt><dd>{s.layer}</dd></div>)}
        {parent && (<div><dt>{S.parent}</dt><dd><button type="button" className="link" onClick={() => onSelect(parent.slug)}>{labelText(parent, lang)}</button></dd></div>)}
        <div><dt>{S.slug}</dt><dd><code>{s.slug}</code></dd></div>
        <div><dt>{S.status}</dt><dd>{S.statusValues[s.status] ?? s.status}</dd></div>
      </dl>
      {children}
      {s.children.length > 0 && (
        <>
          <h3>{S.children}</h3>
          <ul className="children">
            {s.children.map((c) => {
              const child = catalog.structure(c);
              return child ? <li key={c}><button type="button" className="link" onClick={() => onSelect(c)}>{labelText(child, lang)}</button></li> : null;
            })}
          </ul>
        </>
      )}
    </div>
  );
}
