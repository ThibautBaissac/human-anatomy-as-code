import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, labelText, normalize, search } from '../src/viewer/search.ts';
import { ATLAS } from './fixture.ts';

const index = buildSearchIndex(ATLAS);

test('normalize: lower case, no diacritics, ligatures expanded, spaces and hyphens collapsed', () => {
  assert.equal(normalize('  Cœur  Fémoral-Droit '), 'coeur femoral droit');
});

test('labelText falls back from the requested language to fr then en', () => {
  const skin = ATLAS.structures.find((s) => s.slug === 'skin')!;
  assert.equal(labelText(skin, 'la'), 'Cutis');
  assert.equal(labelText(skin, 'fr'), 'skin');
  const thigh = ATLAS.structures.find((s) => s.slug === 'thigh-muscle')!;
  assert.equal(labelText(thigh, 'la'), 'thigh muscle');
});

test('a query shorter than 2 characters gives nothing', () => {
  assert.deepEqual(search(index, 'f', 'fr'), []);
});

test('matches in any language, without accents, and reports where it matched', () => {
  const r = search(index, 'femur', 'fr');
  assert.deepEqual(r[0], { slug: 'femur', name: 'fémur', nameLang: 'fr', matchedLang: 'fr', matchedText: 'fémur' });
  assert.equal(search(index, 'os femoris', 'en')[0].matchedLang, 'la');
  assert.equal(search(index, 'coeur', 'en')[0].name, 'heart');
});

test('synonyms and slugs match too', () => {
  assert.equal(search(index, 'myocarde', 'fr')[0].slug, 'heart');
  const onlySlug = buildSearchIndex({ ...ATLAS, structures: [{ ...ATLAS.structures[1], slug: 'cor-humanum' }] });
  assert.deepEqual(search(onlySlug, 'cor-hum', 'fr')[0], { slug: 'cor-humanum', name: 'cœur', nameLang: 'fr', matchedLang: 'slug', matchedText: 'cor-humanum' });
});

test('ranking: prefix before substring, ties by shorter matched label', () => {
  assert.deepEqual(search(index, 'fe', 'fr').map((x) => x.slug), ['femur', 'lower-limb']); // fémur (prefix), membre inférieur (substring)
  assert.deepEqual(search(index, 'mu', 'en').map((x) => x.slug), ['femur', 'thigh-muscle']); // both substrings: femur is shorter
  assert.deepEqual(search(index, 'he', 'en').map((x) => x.slug), ['heart']);
});

test('exact beats prefix beats substring, then slug order', () => {
  const custom = {
    entries: [
      { slug: 'b', terms: [{ norm: 'xx femur', lang: 'en' as const, text: 'xx femur' }] },
      { slug: 'a', terms: [{ norm: 'femur long', lang: 'en' as const, text: 'femur long' }] },
      { slug: 'c', terms: [{ norm: 'femur', lang: 'en' as const, text: 'femur' }] },
      { slug: 'd', terms: [{ norm: 'femur', lang: 'en' as const, text: 'femur' }] },
    ],
    names: new Map([['a', { en: 'A' }], ['b', { en: 'B' }], ['c', { en: 'C' }], ['d', { en: 'D' }]]),
  };
  assert.deepEqual(search(custom, 'femur', 'en').map((x) => x.slug), ['c', 'd', 'a', 'b']);
});

test('results are capped at the limit', () => {
  assert.equal(search(index, 'er', 'en', 1).length, 1);
});

test('structureName: side name in the language, else fr, else en; whole structure otherwise', async () => {
  const { structureName } = await import('../src/viewer/search.ts');
  const femur = ATLAS.structures.find((s) => s.slug === 'femur')!;
  assert.equal(structureName(femur, 'left', 'fr'), 'fémur gauche');
  assert.equal(structureName(femur, 'left', 'la'), 'fémur gauche'); // no la side name: fr
  const thigh = ATLAS.structures.find((s) => s.slug === 'thigh-muscle')!;
  assert.equal(structureName(thigh, 'right', 'la'), 'right thigh muscle'); // neither la nor fr: en
  assert.equal(structureName(femur, null, 'la'), 'Os femoris');
});

test('labelLang / structureNameLang: the language of the text actually shown, for the lang attribute', async () => {
  const { labelLang, structureNameLang } = await import('../src/viewer/search.ts');
  const skin = ATLAS.structures.find((s) => s.slug === 'skin')!;
  assert.equal(labelLang(skin, 'la'), 'la');
  assert.equal(labelLang(skin, 'fr'), 'en'); // no fr label: the en one is shown
  const femur = ATLAS.structures.find((s) => s.slug === 'femur')!;
  assert.equal(structureNameLang(femur, 'left', 'la'), 'fr');
  const thigh = ATLAS.structures.find((s) => s.slug === 'thigh-muscle')!;
  assert.equal(structureNameLang(thigh, 'right', 'la'), 'en');
  assert.equal(labelLang({ labels: {} }, 'fr'), undefined); // the slug
  const { search: find, buildSearchIndex: build } = await import('../src/viewer/search.ts');
  assert.equal(find(build(ATLAS), 'skin', 'fr')[0].nameLang, 'en');
});
