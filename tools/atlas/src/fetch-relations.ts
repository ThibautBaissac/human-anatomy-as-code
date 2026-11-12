import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { byKey, listYaml } from './fs-util.ts';
import { readWikidata } from './import/wikidata.ts';
import type { Structure } from './types.ts';

// The only code of the project allowed to call the network. Everything else (build, import) reads the snapshots this writes.

const OLS = 'https://www.ebi.ac.uk/ols4/api/v2/ontologies/fma/classes/';
const SPARQL = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'haac-atlas/0.1 (relations fetch)';
const FMA_RELATIONS = new Set(['branch_of', 'tributary_of', 'continuous_distally_with', 'arterial_supply', 'regional_part_of', 'constitutional_part_of']);
const WHOLE_RELATIONS = new Set(['regional_part_of', 'constitutional_part_of']);
const WIKIDATA_PROPERTIES = ['P3261', 'P2286', 'P3189'];
const BATCH = 200;
const ANCESTOR_LEVELS = 3;
const MAX_RETRIES = 5;
const DEFAULT_RETRY_AFTER_S = 60;

export interface FetchOptions {
  fetch?: typeof fetch;
  log?: (s: string) => void;
  /** injected clock, so tests neither wait nor touch real time */
  sleep?: (ms: number) => Promise<void>;
}
export interface FetchSummary { fmaIds: number; qids: number; missingFma: number[] }

// ---------- CSV (RFC 4180, LF) ----------

const cell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Header, then rows sorted by every column in order, duplicates dropped. */
export function toCsv(header: string[], rows: string[][]): string {
  const unique = new Map(rows.map((r) => [JSON.stringify(r), r]));
  const sorted = [...unique.values()].sort((a, b) => {
    for (let i = 0; i < header.length; i++) { const c = byKey(a[i] ?? '', b[i] ?? ''); if (c) return c; }
    return 0;
  });
  return [header, ...sorted].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

export function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------- HTTP: throttle and retry ----------

function http(opts: FetchOptions) {
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = new Set<string>();
  /** One request per second to each service; 429/503 wait Retry-After (default 60 s), up to 5 retries. */
  return async function request(service: string, what: string, url: string, init?: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      if (started.has(service)) await sleep(1000);
      started.add(service);
      const res = await doFetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...(init?.headers as Record<string, string>) } });
      if (res.status !== 429 && res.status !== 503) return res;
      if (attempt >= MAX_RETRIES) throw new Error(`${what} : HTTP ${res.status} après ${MAX_RETRIES} nouvelles tentatives`);
      const retryAfter = Number(res.headers.get('Retry-After'));
      await sleep((Number.isFinite(retryAfter) && res.headers.get('Retry-After') ? retryAfter : DEFAULT_RETRY_AFTER_S) * 1000);
    }
  };
}

// ---------- FMA through OLS4 ----------

const fmaIri = (id: number) => encodeURIComponent(encodeURIComponent(`http://purl.org/sig/ont/fma/fma${id}`));

/** Restrictions of an OLS4 v2 class (`relatedTo`), reduced to the six relations we keep, named as OLS names the property. */
export function parseOlsRelations(cls: unknown): { relation: string; target: number }[] {
  const related = ((cls as { relatedTo?: { property?: string; value?: unknown; isObsolete?: boolean }[] }).relatedTo ?? []);
  const out: { relation: string; target: number }[] = [];
  for (const r of related) {
    const relation = r.property?.split('/').pop() ?? '';
    const m = typeof r.value === 'string' ? r.value.match(/\/fma(\d+)$/) : null;
    if (r.isObsolete || !FMA_RELATIONS.has(relation) || !m) continue;
    out.push({ relation, target: Number(m[1]) });
  }
  return out;
}

// ---------- Wikidata ----------

const qidOf = (uri: string) => uri.replace(/^.*\//, '');

function readQueries(dataDir: string): [string, string] {
  const [relations, targets] = readFileSync(join(dataDir, 'import', 'relations-wikidata.rq'), 'utf8').split(/^# ---.*$/m);
  if (!relations || !targets) throw new Error('relations-wikidata.rq : deux requêtes attendues, séparées par une ligne « # --- »');
  return [relations, targets];
}

const fill = (query: string, qids: string[]) => query.replace(/^(\s*VALUES \?(?:item|qid) )\{\}/m, `$1{ ${qids.map((q) => `wd:${q}`).join(' ')} }`);

// ---------- Subjects ----------

interface Subjects { fmaIds: Set<number>; qids: Set<string>; muscleFmaIds: Set<number> }

function readSubjects(dataDir: string): Subjects {
  const s: Subjects = { fmaIds: new Set(), qids: new Set(), muscleFmaIds: new Set() };
  for (const file of listYaml(join(dataDir, 'structures'))) {
    const st = parse(readFileSync(file, 'utf8')) as Structure;
    for (const ids of [st.ids, ...Object.values(st.sides ?? {}).map((b) => b?.ids)]) {
      if (ids?.fma) { s.fmaIds.add(ids.fma); if (st.kind === 'muscle') s.muscleFmaIds.add(ids.fma); }
      if (ids?.wikidata) s.qids.add(ids.wikidata);
    }
  }
  return s;
}

// ---------- Command ----------

export async function fetchRelations(dataDir: string, opts: FetchOptions = {}): Promise<FetchSummary> {
  const log = opts.log ?? (() => {});
  const request = http(opts);
  const { fmaIds, qids, muscleFmaIds } = readSubjects(dataDir);
  const wikidata = readWikidata(join(dataDir, 'import', 'wikidata-fma.csv'));
  const [relationsQuery, targetsQuery] = readQueries(dataDir);

  // FMA: our ids first, then the whole-parts of muscles, three levels up (their own relations are fetched too).
  const fmaRows: string[][] = [];
  const missingFma: number[] = [];
  const done = new Set<number>();
  let level = [...fmaIds].sort((a, b) => a - b);
  const wholes = new Set<number>(); // muscle ancestors, whose QIDs join the Wikidata subjects
  let muscles = new Set(muscleFmaIds);
  for (let depth = 0; depth <= ANCESTOR_LEVELS && level.length; depth++) {
    const nextMuscles = new Set<number>();
    const next: number[] = [];
    for (const id of level) {
      if (done.has(id)) continue;
      done.add(id);
      const res = await request('ols', `FMA ${id}`, OLS + fmaIri(id));
      if (res.status === 404) { missingFma.push(id); log(`FMA ${id} : absent d'OLS4`); continue; }
      if (!res.ok) throw new Error(`FMA ${id} : HTTP ${res.status}`);
      for (const { relation, target } of parseOlsRelations(await res.json())) {
        fmaRows.push([String(id), relation, String(target)]);
        if (depth < ANCESTOR_LEVELS && muscles.has(id) && WHOLE_RELATIONS.has(relation)) { next.push(target); nextMuscles.add(target); wholes.add(target); }
      }
    }
    level = [...new Set(next)].filter((i) => !done.has(i)).sort((a, b) => a - b);
    muscles = nextMuscles;
  }

  // Wikidata: our QIDs plus the QIDs of the muscle wholes.
  const subjects = new Set(qids);
  for (const w of [...muscleFmaIds, ...wholes]) { const q = wikidata.byFma.get(w)?.qid; if (q) subjects.add(q); }
  const sparql = async (what: string, query: string) => {
    const res = await request('wikidata', what, SPARQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
      body: new URLSearchParams({ query }).toString(),
    });
    if (!res.ok) throw new Error(`${what} : HTTP ${res.status}`);
    return ((await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings;
  };
  const wdRows: string[][] = [];
  const innervationTargets = new Set<string>();
  const sortedSubjects = [...subjects].sort(byKey);
  for (const [i, batch] of batches(sortedSubjects, BATCH).entries()) {
    for (const b of await sparql(`lot Wikidata ${i + 1} (${batch[0]}…${batch[batch.length - 1]})`, fill(relationsQuery, batch))) {
      const prop = qidOf(b.prop.value);
      if (!WIKIDATA_PROPERTIES.includes(prop)) continue;
      wdRows.push([qidOf(b.item.value), prop, qidOf(b.target.value)]);
      if (prop === 'P3189') innervationTargets.add(qidOf(b.target.value));
    }
  }

  const labels = new Map<string, string[]>();
  const sortedTargets = [...innervationTargets].sort(byKey);
  for (const [i, batch] of batches(sortedTargets, BATCH).entries()) {
    for (const b of await sparql(`lot de cibles Wikidata ${i + 1} (${batch[0]}…${batch[batch.length - 1]})`, fill(targetsQuery, batch))) {
      const q = qidOf(b.qid.value);
      const row = labels.get(q) ?? ['', '', '', ''];
      for (const [j, k] of ['fma', 'en', 'fr', 'la'].entries()) if (!row[j] && b[k]) row[j] = b[k].value;
      labels.set(q, row);
    }
  }

  // the three snapshots describe one fetch: written together, only once every request has succeeded
  const snapshots: [string, string][] = [
    ['relations-fma.csv', toCsv(['subject_fma', 'relation', 'target_fma'], fmaRows)],
    ['relations-wikidata.csv', toCsv(['subject_qid', 'property', 'target_qid'], wdRows)],
    ['wikidata-targets.csv', toCsv(['qid', 'fma', 'en', 'fr', 'la'], sortedTargets.map((q) => [q, ...(labels.get(q) ?? ['', '', '', ''])]))],
  ];
  mkdirSync(join(dataDir, 'import'), { recursive: true });
  for (const [name, csv] of snapshots) writeFileSync(join(dataDir, 'import', name), csv);

  const summary = { fmaIds: done.size, qids: subjects.size, missingFma: missingFma.sort((a, b) => a - b) };
  log(`FMA : ${summary.fmaIds} identifiants interrogés, ${summary.missingFma.length} absents${summary.missingFma.length ? ` (${summary.missingFma.join(', ')})` : ''}`);
  log(`Wikidata : ${summary.qids} items`);
  log(`écrit : relations-fma.csv (${new Set(fmaRows.map((r) => r.join())).size} lignes), relations-wikidata.csv (${new Set(wdRows.map((r) => r.join())).size}), wikidata-targets.csv (${sortedTargets.length})`);
  return summary;
}
