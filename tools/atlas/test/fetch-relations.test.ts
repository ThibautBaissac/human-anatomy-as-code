import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchRelations, batches, toCsv } from '../src/fetch-relations.ts';
import { writeDataset } from './helpers.ts';

const rq = readFileSync(new URL('../../../data/import/relations-wikidata.rq', import.meta.url), 'utf8');
const fixture = (name: string) => readFileSync(new URL(`./fixtures/ols/${name}.json`, import.meta.url), 'utf8');
const WD_HEADER = 'item,fma,uberon,ta2,ta98,fr,la,en\n';
const structure = (slug: string, kind: string, ids: object) => ({ slug, kind, laterality: 'midline', status: 'draft', labels: { en: { text: slug, source: 'fma', status: 'draft' } }, ids });
const olsClass = (related: [string, number][]) => JSON.stringify({ relatedTo: related.map(([p, v]) => ({ property: `http://purl.org/sig/ont/fma/${p}`, value: `http://purl.org/sig/ont/fma/fma${v}`, isObsolete: false })) });
const read = (dir: string, f: string) => readFileSync(join(dir, 'import', f), 'utf8');
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
const noSleep = async () => {};

function dataset(extra: Record<string, unknown> = {}, wikidataCsv = WD_HEADER) {
  return writeDataset({ 'import/relations-wikidata.rq': rq, 'import/wikidata-fma.csv': wikidataCsv, ...extra });
}

/** Routes OLS class requests by FMA id (the IRI is encoded twice) and everything else to `other`. */
function router(ols: Record<number, Response | string>, other: (url: string, init?: RequestInit) => Response | Promise<Response> = () => json({ results: { bindings: [] } })) {
  const calls: string[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push(u);
    const m = u.match(/ontologies\/fma\/classes\/(.+)$/);
    if (!m) return other(u, init);
    assert.equal(decodeURIComponent(decodeURIComponent(m[1])).startsWith('http://purl.org/sig/ont/fma/fma'), true);
    const id = Number(decodeURIComponent(decodeURIComponent(m[1])).replace(/\D/g, ''));
    const r = ols[id];
    if (r === undefined) return new Response('not found', { status: 404 });
    return typeof r === 'string' ? new Response(r, { status: 200 }) : r;
  }) as typeof fetch;
  return { fn, calls };
}

test('FMA classes become sorted relations-fma.csv rows; only the six relations are kept; a 404 is listed as missing', async () => {
  const dir = dataset({
    'structures/artery/a.yaml': structure('a', 'artery', { fma: 22457 }),
    'structures/artery/b.yaml': structure('b', 'artery', { fma: 22441 }),
    'structures/artery/c.yaml': structure('c', 'artery', { fma: 13363 }),
  });
  const { fn } = router({
    22441: fixture('fma22441'),
    22457: olsClass([['regional_part_of', 5], ['branch_of', 3], ['nerve_supply', 9], ['branch_of', 3]]),
  });
  const r = await fetchRelations(dir, { fetch: fn, log: () => {}, sleep: noSleep });
  assert.equal(read(dir, 'relations-fma.csv'), [
    'subject_fma,relation,target_fma',
    '22441,arterial_supply,70269',
    '22457,branch_of,3',
    '22457,regional_part_of,5',
    '',
  ].join('\n').replace(/\n$/, '\n'));
  assert.deepEqual(r.missingFma, [13363]);
  assert.equal(r.fmaIds, 3);
});

test('a muscle also fetches its regional/constitutional ancestors, up to 3 levels, and their QIDs', async () => {
  const dir = dataset({
    'structures/muscle/m.yaml': structure('m', 'muscle', { fma: 1 }),
  }, WD_HEADER + 'http://www.wikidata.org/entity/Q1,1,,,,,,m\nhttp://www.wikidata.org/entity/Q2,2,,,,,,w2\nhttp://www.wikidata.org/entity/Q3,3,,,,,,w3\nhttp://www.wikidata.org/entity/Q4,4,,,,,,w4\nhttp://www.wikidata.org/entity/Q5,5,,,,,,w5\n');
  const sparql: string[] = [];
  const { fn, calls } = router(
    { 1: olsClass([['regional_part_of', 2]]), 2: olsClass([['constitutional_part_of', 3]]), 3: olsClass([['regional_part_of', 4]]), 4: olsClass([['regional_part_of', 5]]) },
    (_u, init) => { sparql.push(String(init?.body)); return json({ results: { bindings: [] } }); },
  );
  const r = await fetchRelations(dir, { fetch: fn, log: () => {}, sleep: noSleep });
  assert.equal(calls.filter((c) => c.includes('/classes/')).length, 4); // 1,2,3,4 ; 5 is level 4
  assert.equal(r.fmaIds, 4);
  const body = decodeURIComponent(sparql[0].replace(/\+/g, ' '));
  for (const q of ['wd:Q1', 'wd:Q2', 'wd:Q3', 'wd:Q4']) assert.ok(body.includes(q), q);
  assert.ok(!body.includes('wd:Q5'));
});

test('SPARQL bindings become relations-wikidata.csv rows; P3189 targets get a labels row; request carries the User-Agent', async () => {
  const dir = dataset({ 'structures/artery/a.yaml': structure('a', 'artery', { wikidata: 'Q10' }) });
  const seen: RequestInit[] = [];
  const b = (item: string, prop: string, target: string) => ({ item: { value: `http://www.wikidata.org/entity/${item}` }, prop: { value: `http://www.wikidata.org/prop/direct/${prop}` }, target: { value: `http://www.wikidata.org/entity/${target}` } });
  const { fn } = router({}, (_u, init) => {
    seen.push(init!);
    const q = decodeURIComponent(String(init!.body).replace(/\+/g, ' '));
    if (q.includes('P1402') && q.includes('?en')) return json({ results: { bindings: [{ qid: { value: 'http://www.wikidata.org/entity/Q99' }, fma: { value: '77' }, en: { value: 'aorta, "big"' } }] } });
    return json({ results: { bindings: [b('Q10', 'P3261', 'Q20'), b('Q10', 'P3189', 'Q99')] } });
  });
  await fetchRelations(dir, { fetch: fn, log: () => {}, sleep: noSleep });
  assert.equal(read(dir, 'relations-wikidata.csv'), 'subject_qid,property,target_qid\nQ10,P3189,Q99\nQ10,P3261,Q20\n');
  assert.equal(read(dir, 'wikidata-targets.csv'), 'qid,fma,en,fr,la\nQ99,77,"aorta, ""big""",,\n');
  assert.equal((seen[0].method), 'POST');
  assert.equal((seen[0].headers as Record<string, string>)['User-Agent'], 'haac-atlas/0.1 (relations fetch)');
});

test('1441 QIDs are split into batches of at most 200', () => {
  const qids = Array.from({ length: 1441 }, (_, i) => `Q${i + 1}`);
  const parts = batches(qids, 200);
  assert.equal(parts.length, 8);
  assert.ok(parts.every((p) => p.length <= 200));
  assert.equal(parts.flat().length, 1441);
});

test('a 429 is retried after Retry-After, with the injected clock; 1 request per second otherwise', async () => {
  const dir = dataset({ 'structures/artery/a.yaml': structure('a', 'artery', { fma: 22457 }) });
  let n = 0;
  const { fn } = router({});
  const wrapped = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes('/classes/') && n++ === 0) return new Response('slow down', { status: 429, headers: { 'Retry-After': '7' } });
    return String(url).includes('/classes/') ? new Response(olsClass([['branch_of', 3]])) : fn(url, init);
  }) as typeof fetch;
  const sleeps: number[] = [];
  await fetchRelations(dir, { fetch: wrapped, log: () => {}, sleep: async (ms) => { sleeps.push(ms); } });
  assert.ok(sleeps.includes(7000));
  assert.equal(read(dir, 'relations-fma.csv'), 'subject_fma,relation,target_fma\n22457,branch_of,3\n');
});

test('after 5 retries the failure names the batch', async () => {
  const dir = dataset({ 'structures/artery/a.yaml': structure('a', 'artery', { fma: 22457 }) });
  const fn = (async () => new Response('', { status: 503 })) as typeof fetch;
  await assert.rejects(fetchRelations(dir, { fetch: fn, log: () => {}, sleep: noSleep }), /FMA 22457/);
});

test('toCsv quotes fields, sorts rows by every column and drops duplicates', () => {
  assert.equal(toCsv(['a', 'b'], [['2', 'x'], ['1', 'y,z'], ['1', 'y,z'], ['1', 'a']]), 'a,b\n1,a\n1,"y,z"\n2,x\n');
});
