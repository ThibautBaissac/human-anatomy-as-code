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

test('muscles named after a bone are muscles, not bones', () => {
  for (const name of ['extensor carpi ulnaris', 'humeral head of flexor carpi ulnaris', 'ulnar head of pronator teres', 'fibularis brevis',
    'fibularis longus', 'fibularis tertius', 'tibialis anterior', 'tibialis posterior', 'levator scapulae', 'subscapularis']) {
    assert.equal(kindOfName(name), 'muscle', name);
  }
});

test('the iliotibial tract is a fascia; bone names still match as whole words', () => {
  assert.equal(kindOfName('iliotibial tract'), 'fascia');
  for (const name of ['left ulna', 'head of radius', 'shaft of tibia', 'scapula', 'neck of femur', 'first metacarpal bone', 'neurocranium', 'viscerocranium', 'basicranium']) assert.equal(kindOfName(name), 'bone', name);
});

test('back and neck muscles are muscles by their own name (their is-a ancestors name the vertebral column)', () => {
  for (const name of ['longissimus thoracis', 'longissimus capitis', 'iliocostalis lumborum', 'spinalis thoracis', 'spinalis', 'semispinalis capitis',
    'splenius cervicis', 'serratus posterior inferior', 'psoas major', 'coccygeus', 'longus capitis']) {
    assert.equal(kindOfName(name), 'muscle', name);
  }
  assert.equal(kindOfName('triquetral'), undefined); // a carpal bone: left to its ancestors
});

test('kidney, spleen and adrenal gland are organs (their is-a ancestors have a cortex and a medulla)', () => {
  for (const name of ['kidney', 'left kidney', 'spleen', 'adrenal gland', 'right suprarenal gland']) assert.equal(kindOfName(name), 'organ', name);
  // their vessels and nerves keep their own kind
  for (const [name, kind] of [['renal artery', 'artery'], ['splenic vein', 'vein'], ['artery of kidney', 'artery']]) assert.equal(kindOfName(name), kind, name);
});

test('parts of the trapezius, interspinales and intertransversarii are muscles', () => {
  for (const name of ['ascending part of trapezius', 'descending part of trapezius', 'set of interspinales cervicis', 'set of interspinales lumborum',
    'set of anterior cervical intertransversarii', 'set of posterior cervical intertransversarii']) assert.equal(kindOfName(name), 'muscle', name);
});
