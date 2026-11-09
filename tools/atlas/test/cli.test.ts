import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validDataset, validStructures } from './helpers.ts';

const CLI = new URL('../src/cli.ts', import.meta.url).pathname;
const run = (...args: string[]) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const S = validStructures();
const broken = () => validDataset({ 'structures/organ/heart.yaml': { ...S['structures/organ/heart.yaml'], parent: 'nowhere' } });

test('validate exits 0 on a valid dataset', () => {
  const r = run('validate', validDataset());
  assert.equal(r.status, 0, r.stderr);
});

test('validate exits 1 and prints file:pointer rule message for each error', () => {
  const r = run('validate', broken());
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /structures\/organ\/heart\.yaml:\/parent parent-exists /);
});

test('build writes atlas.json when valid', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'atlas-out-')), 'atlas.json');
  const r = run('build', validDataset(), out);
  assert.equal(r.status, 0, r.stderr);
  const atlas = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(atlas.structures.length, 5);
});

test('build refuses to write when there are errors', () => {
  const out = join(mkdtempSync(join(tmpdir(), 'atlas-out-')), 'atlas.json');
  const r = run('build', broken(), out);
  assert.equal(r.status, 1);
  assert.equal(existsSync(out), false);
});

test('import-bp3d reads the overrides file, writes structures, validates and prints the report', async () => {
  const { writeDataset, sources } = await import('./helpers.ts');
  const FIX = new URL('./fixtures/', import.meta.url).pathname;
  const dataDir = writeDataset({ ...sources, 'import/bp3d-overrides.yaml': { noFold: ['atrium'], ties: {}, slugs: {} } });
  const r = run('import-bp3d', join(FIX, 'bp3d'), join(FIX, 'wikidata.csv'), dataDir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dataDir, 'structures/organ/left-atrium.yaml')));
  assert.match(r.stdout + r.stderr, /créées\s*:?\s*\d+/);
});

test('import-bp3d reports a missing input as a one-line error, without a stack trace', () => {
  const r = run('import-bp3d', '/nonexistent/bp3d', '/nonexistent.csv', validDataset());
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  assert.match(r.stderr, /nonexistent/);
});

test('build also writes atlas-male.json and atlas-female.json next to atlas.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-out-'));
  const out = join(dir, 'atlas.json');
  const r = run('build', validDataset(), out);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(dir, 'atlas-male.json'), 'utf8'), readFileSync(out, 'utf8'));
  assert.equal(JSON.parse(readFileSync(join(dir, 'atlas-female.json'), 'utf8')).structures.length, 5);
});
