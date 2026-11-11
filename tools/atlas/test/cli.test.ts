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

test('warnings are counted by rule by default, listed one by one with --verbose; errors are always listed', () => {
  const short = run('validate', broken());
  assert.match(short.stderr, /^warning missing-la : 2$/m);
  assert.doesNotMatch(short.stderr, /^warning structures\//m);
  assert.match(short.stderr, /^error structures\/organ\/heart\.yaml:\/parent parent-exists /m);
  assert.match(short.stderr, /--verbose/);
  const full = run('validate', '--verbose', broken());
  assert.match(full.stderr, /^warning structures\/\S+\.yaml:\/labels missing-la /m);
  assert.equal(full.status, 1);
});

test('build writes one atlas per model into the output directory, and no atlas.json', () => {
  const out = mkdtempSync(join(tmpdir(), 'atlas-out-'));
  const r = run('build', validDataset(), out);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(readFileSync(join(out, 'atlas-male.json'), 'utf8')).structures.length, 5);
  assert.equal(JSON.parse(readFileSync(join(out, 'atlas-female.json'), 'utf8')).structures.length, 5);
  assert.equal(existsSync(join(out, 'atlas.json')), false);
});

test('build refuses to write when there are errors', () => {
  const out = mkdtempSync(join(tmpdir(), 'atlas-out-'));
  const r = run('build', broken(), out);
  assert.equal(r.status, 1);
  assert.equal(existsSync(join(out, 'atlas-male.json')), false);
});

test('validate and build fail on a missing data directory or one without structures/', () => {
  for (const dir of ['/nonexistent/data', mkdtempSync(join(tmpdir(), 'atlas-empty-'))]) {
    const r = run('validate', dir);
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /data-dir/);
    const out = mkdtempSync(join(tmpdir(), 'atlas-out-'));
    assert.equal(run('build', dir, out).status, 1);
    assert.equal(existsSync(join(out, 'atlas-male.json')), false);
  }
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

test('import-bp3d reads an empty overrides file as no overrides', async () => {
  const { writeDataset, sources } = await import('./helpers.ts');
  const FIX = new URL('./fixtures/', import.meta.url).pathname;
  const dataDir = writeDataset({ ...sources, 'import/bp3d-overrides.yaml': '# rien\n' });
  const r = run('import-bp3d', join(FIX, 'bp3d'), join(FIX, 'wikidata.csv'), dataDir);
  assert.doesNotMatch(r.stderr, /TypeError|Cannot read/);
  assert.match(r.stdout, /créées\s*:?\s*\d+/);
});

test('import-bp3d reports a missing input as a one-line error, without a stack trace', () => {
  const r = run('import-bp3d', '/nonexistent/bp3d', '/nonexistent.csv', validDataset());
  assert.equal(r.status, 1);
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  assert.match(r.stderr, /nonexistent/);
});
