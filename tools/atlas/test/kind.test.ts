import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindOfName } from '../src/import/rules.ts';

test('vessels and nerves named after a bone are not bones', () => {
  assert.equal(kindOfName('anterior tibial artery'), 'artery');
  assert.equal(kindOfName('set of dorsal metacarpal arteries'), 'artery');
  assert.equal(kindOfName('anterior tibial vein'), 'vein');
  assert.equal(kindOfName('vertebral artery'), 'artery');
  assert.equal(kindOfName('femoral nerve'), 'nerve');
  assert.equal(kindOfName('radial nerve'), 'nerve');
});

test('bones, muscles and the central nervous system keep their kind', () => {
  assert.equal(kindOfName('tibia'), 'bone');
  assert.equal(kindOfName('first metacarpal bone'), 'bone');
  assert.equal(kindOfName('biceps brachii'), 'muscle');
  assert.equal(kindOfName('cerebellum'), 'cns');
  assert.equal(kindOfName('middle cerebral artery'), 'artery');
});
