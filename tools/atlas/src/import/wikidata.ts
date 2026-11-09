import { readFileSync } from 'node:fs';

export interface WikidataRow {
  qid: string;
  fma?: number;
  uberon?: string;
  ta2?: number;
  ta98?: string;
  fr?: string;
  la?: string;
  en?: string;
}

export interface Wikidata {
  byFma: Map<number, WikidataRow>;
  /** UBERON id without prefix (e.g. "0000995") → preferred item */
  byUberon: Map<string, WikidataRow>;
  byEn: Map<string, WikidataRow>;
  byQid: Map<string, WikidataRow>;
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
  const idx = { item: col('item'), fma: col('fma'), uberon: col('uberon'), ta2: col('ta2'), ta98: col('ta98'), fr: col('fr'), la: col('la'), en: col('en') };
  const byFma = new Map<number, WikidataRow>();
  const byUberon = new Map<string, WikidataRow>();
  const byEn = new Map<string, WikidataRow>();
  const byQid = new Map<string, WikidataRow>();
  for (const l of lines) {
    if (l.length < header.length) continue;
    const fma = l[idx.fma] ? Number(l[idx.fma]) : undefined;
    const uberon = idx.uberon >= 0 && l[idx.uberon] ? l[idx.uberon] : undefined;
    if (!(fma && Number.isInteger(fma) && fma > 0) && !uberon) continue;
    const opt = (i: number) => (l[i] ? l[i] : undefined);
    const row: WikidataRow = {
      qid: l[idx.item].replace(/^.*\//, ''),
      fma: fma && Number.isInteger(fma) && fma > 0 ? fma : undefined,
      uberon,
      ta2: l[idx.ta2] ? Number(l[idx.ta2]) : undefined,
      ta98: opt(idx.ta98),
      fr: opt(idx.fr),
      la: opt(idx.la),
      en: opt(idx.en),
    };
    if (!byQid.has(row.qid)) byQid.set(row.qid, row);
    if (row.fma) {
      const prev = byFma.get(row.fma);
      if (!prev || better(row, prev)) byFma.set(row.fma, row);
    }
    if (row.uberon) {
      const prev = byUberon.get(row.uberon);
      if (!prev || better(row, prev)) byUberon.set(row.uberon, row);
    }
    // The English-label lookup serves the BodyParts3D import (FMA anchor): FMA items only.
    if (row.en && row.fma) {
      const key = row.en.toLowerCase();
      const p = byEn.get(key);
      if (!p || better(row, p)) byEn.set(key, row);
    }
  }
  return { byFma, byUberon, byEn, byQid };
}
