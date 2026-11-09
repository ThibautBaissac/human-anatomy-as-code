import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readWikidata } from '../src/import/wikidata.ts';

test('readWikidata indexes items by FMA and by UBERON; UBERON-only rows are kept', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'wd-')), 'wd.csv');
  writeFileSync(p, [
    'item,fma,uberon,ta2,ta98,fr,la,en',
    'http://www.wikidata.org/entity/Q1,7214,0002119,,,ovaire gauche,,left ovary',
    'http://www.wikidata.org/entity/Q2,,0000995,3517,A09.1.03.001,utérus,Uterus,uterus',
  ].join('\n') + '\n');
  const wd = readWikidata(p);
  assert.equal(wd.byFma.get(7214)?.qid, 'Q1');
  assert.equal(wd.byUberon.get('0002119')?.qid, 'Q1');
  assert.equal(wd.byUberon.get('0000995')?.fr, 'utérus');
  assert.equal(wd.byFma.size, 1);
});

test('readWikidata still reads the older export without an uberon column', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'wd-')), 'wd.csv');
  writeFileSync(p, 'item,fma,ta2,ta98,fr,la,en\nhttp://www.wikidata.org/entity/Q3,9611,1360,A02.5.04.001,fémur,Os femoris,femur\n');
  assert.equal(readWikidata(p).byFma.get(9611)?.fr, 'fémur');
});
