import { readFileSync } from 'node:fs';

export interface WikidataRow {
  qid: string;
  fma: number;
  ta2?: number;
  ta98?: string;
  fr?: string;
  la?: string;
  en?: string;
}

export interface Wikidata {
  byFma: Map<number, WikidataRow>;
  byEn: Map<string, WikidataRow>;
}

/** Minimal RFC 4180 parser (quoted fields, doubled quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Preferred item first: has a TA2 id, then a French label, then the smallest QID. */
function better(a: WikidataRow, b: WikidataRow): boolean {
  if (!!a.ta2 !== !!b.ta2) return !!a.ta2;
  if (!!a.fr !== !!b.fr) return !!a.fr;
  return Number(a.qid.slice(1)) < Number(b.qid.slice(1));
}

export function readWikidata(path: string): Wikidata {
  const [header, ...lines] = parseCsv(readFileSync(path, 'utf8'));
  const required = ['item', 'fma', 'ta2', 'ta98', 'fr', 'la', 'en'];
  const missing = required.filter((c) => !header?.includes(c));
  if (missing.length) throw new Error(`colonne(s) absente(s) de ${path} : ${missing.join(', ')}`);
  const col = (name: string) => header.indexOf(name);
  const idx = { item: col('item'), fma: col('fma'), ta2: col('ta2'), ta98: col('ta98'), fr: col('fr'), la: col('la'), en: col('en') };
  const byFma = new Map<number, WikidataRow>();
  const byEn = new Map<string, WikidataRow>();
  for (const l of lines) {
    if (l.length < header.length) continue;
    const fma = Number(l[idx.fma]);
    if (!Number.isInteger(fma) || fma <= 0) continue;
    const opt = (i: number) => (l[i] ? l[i] : undefined);
    const row: WikidataRow = {
      qid: l[idx.item].replace(/^.*\//, ''),
      fma,
      ta2: l[idx.ta2] ? Number(l[idx.ta2]) : undefined,
      ta98: opt(idx.ta98),
      fr: opt(idx.fr),
      la: opt(idx.la),
      en: opt(idx.en),
    };
    const prev = byFma.get(fma);
    if (!prev || better(row, prev)) byFma.set(fma, row);
    if (row.en) {
      const key = row.en.toLowerCase();
      const p = byEn.get(key);
      if (!p || better(row, p)) byEn.set(key, row);
    }
  }
  return { byFma, byEn };
}
