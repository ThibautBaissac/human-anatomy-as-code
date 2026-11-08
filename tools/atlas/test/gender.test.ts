import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genderOf } from '../src/import/rules.ts';

test('fr: frequent head nouns of BodyParts3D labels', () => {
  assert.deepEqual(genderOf('chef long du muscle biceps brachial', 'fr'), { gender: 'm', number: 'sg' });
  assert.deepEqual(genderOf('partie descendante du muscle trapèze', 'fr'), { gender: 'f', number: 'sg' });
  assert.deepEqual(genderOf('aorte thoracique', 'fr'), { gender: 'f', number: 'sg' });
  assert.deepEqual(genderOf('gyrus précentral', 'fr'), { gender: 'm', number: 'sg' });
  assert.deepEqual(genderOf('voies biliaires', 'fr'), { gender: 'f', number: 'pl' });
});

test('fr: an ordinal in -ième takes the gender of the next word; premier/première carry it', () => {
  assert.deepEqual(genderOf('deuxième côte', 'fr'), { gender: 'f', number: 'sg' });
  assert.deepEqual(genderOf('quatrième ventricule', 'fr'), { gender: 'm', number: 'sg' });
  assert.deepEqual(genderOf('première côte', 'fr'), { gender: 'f', number: 'sg' });
  assert.deepEqual(genderOf('premier métacarpien', 'fr'), { gender: 'm', number: 'sg' });
  assert.equal(genderOf('cinquième truc', 'fr'), undefined);
});

test('la: frequent head nouns, singular and plural', () => {
  assert.deepEqual(genderOf('Caput longum musculi bicipitis brachii', 'la'), { gender: 'n', number: 'sg' });
  assert.deepEqual(genderOf('Systema nervosum centrale', 'la'), { gender: 'n', number: 'sg' });
  assert.deepEqual(genderOf('Arcus aortae', 'la'), { gender: 'm', number: 'sg' });
  assert.deepEqual(genderOf('Valva aortae', 'la'), { gender: 'f', number: 'sg' });
  assert.deepEqual(genderOf('Corpora quadrigemina', 'la'), { gender: 'n', number: 'pl' });
});

test('unknown head noun gives no gender', () => {
  assert.equal(genderOf('zzz', 'fr'), undefined);
  assert.equal(genderOf('Iliocostalis', 'la'), undefined);
});
