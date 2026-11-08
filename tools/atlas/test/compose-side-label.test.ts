import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeSideLabel } from '../src/compose-side-label.ts';

const L = (text: string, extra: Record<string, string> = {}) => ({ text, source: 'wikidata', status: 'draft' as const, ...extra });

test('en: side word goes before the term', () => {
  assert.equal(composeSideLabel(L('femur'), 'en', 'left'), 'left femur');
  assert.equal(composeSideLabel(L('biceps brachii'), 'en', 'right'), 'right biceps brachii');
});

test('fr: gauche agrees only in number', () => {
  assert.equal(composeSideLabel(L('fémur', { gender: 'm' }), 'fr', 'left'), 'fémur gauche');
  assert.equal(composeSideLabel(L('artère carotide commune', { gender: 'f' }), 'fr', 'left'), 'artère carotide commune gauche');
  assert.equal(composeSideLabel(L('muscles du bras', { gender: 'm', number: 'pl' }), 'fr', 'left'), 'muscles du bras gauches');
});

test('fr: droit agrees in gender and number', () => {
  const cases: [string, string, string, string][] = [
    ['fémur', 'm', 'sg', 'fémur droit'],
    ['artère carotide commune', 'f', 'sg', 'artère carotide commune droite'],
    ['muscles du bras', 'm', 'pl', 'muscles du bras droits'],
    ['veines pulmonaires', 'f', 'pl', 'veines pulmonaires droites'],
  ];
  for (const [text, gender, number, expected] of cases) {
    assert.equal(composeSideLabel(L(text, { gender, number }), 'fr', 'right'), expected);
  }
});

test('la: sinister / dexter decline in gender and number', () => {
  const cases: [string, string, string, string, string][] = [
    ['musculus biceps brachii', 'm', 'sg', 'musculus biceps brachii sinister', 'musculus biceps brachii dexter'],
    ['arteria carotis communis', 'f', 'sg', 'arteria carotis communis sinistra', 'arteria carotis communis dextra'],
    ['femur', 'n', 'sg', 'femur sinistrum', 'femur dextrum'],
    ['musculi brachii', 'm', 'pl', 'musculi brachii sinistri', 'musculi brachii dextri'],
    ['venae pulmonales', 'f', 'pl', 'venae pulmonales sinistrae', 'venae pulmonales dextrae'],
    ['ossa carpi', 'n', 'pl', 'ossa carpi sinistra', 'ossa carpi dextra'],
  ];
  for (const [text, gender, number, left, right] of cases) {
    assert.equal(composeSideLabel(L(text, { gender, number }), 'la', 'left'), left);
    assert.equal(composeSideLabel(L(text, { gender, number }), 'la', 'right'), right);
  }
});

test('missing gender falls back to masculine singular', () => {
  assert.equal(composeSideLabel(L('rein'), 'fr', 'right'), 'rein droit');
  assert.equal(composeSideLabel(L('ren'), 'la', 'left'), 'ren sinister');
});

test('missing gender means masculine singular even when a number is given', () => {
  assert.equal(composeSideLabel(L('reins', { number: 'pl' }), 'fr', 'right'), 'reins droit');
});
