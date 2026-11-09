import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEMS, systemsOf } from '../src/import/rules.ts';

const of = (kind: string, name: string, ancestors: string[] = []) => systemsOf({ kind, name, ancestors });

test('the vocabulary: 12 systems in display order', () => {
  assert.deepEqual(SYSTEMS, ['skeletal', 'muscular', 'cardiovascular', 'lymphatic', 'nervous', 'sensory', 'respiratory', 'digestive', 'urinary', 'genital', 'endocrine', 'integumentary']);
});

test('a system group among the ancestors gives its system', () => {
  assert.deepEqual(of('organ', 'cecum', ['large-intestine', 'alimentary-system', 'human-body']), ['digestive']);
  assert.deepEqual(of('organ', 'ureter', ['upper-urinary-tract', 'urinary-system']), ['urinary']);
  assert.deepEqual(of('organ', 'pineal body', ['endocrine-system']), ['endocrine']);
  // the musculoskeletal and fascial groups give nothing by themselves: the kind settles it
  assert.deepEqual(of('cartilage', 'costal cartilage', ['musculoskeletal-system']), ['skeletal']);
});

test('name keywords give systems, several when the organ belongs to several', () => {
  assert.deepEqual(of('organ', 'pancreas'), ['digestive', 'endocrine']);
  assert.deepEqual(of('organ', 'kidney'), ['urinary']);
  assert.deepEqual(of('organ', 'left lung'), ['respiratory']);
  assert.deepEqual(of('organ', 'eyeball'), ['sensory']);
  assert.deepEqual(of('organ', 'thyroid gland'), ['endocrine']);
  assert.deepEqual(of('organ', 'spleen'), ['lymphatic']);
  assert.deepEqual(of('organ', 'heart'), ['cardiovascular']);
  assert.deepEqual(of('organ', 'uterus'), ['genital']);
  assert.deepEqual(of('organ', 'left mammary gland'), ['genital']);
  assert.deepEqual(of('organ', 'pharynx'), ['respiratory', 'digestive']);
  assert.deepEqual(of('organ', 'cavity of left ventricle'), ['cardiovascular']);
  assert.deepEqual(of('organ', 'corpus callosum'), ['nervous']);
});

test('tissue kinds always add their system: the diaphragm is a muscle of breathing', () => {
  assert.deepEqual(of('muscle', 'diaphragm'), ['muscular', 'respiratory']);
  assert.deepEqual(of('bone', 'femur'), ['skeletal']);
  assert.deepEqual(of('ligament', 'long plantar ligament'), ['skeletal']);
  assert.deepEqual(of('fascia', 'iliotibial tract'), ['muscular']);
  assert.deepEqual(of('bone', 'first molar tooth'), ['skeletal', 'digestive']);
});

test('vessels and nerves stay in their own system, whatever their name or ancestors', () => {
  assert.deepEqual(of('artery', 'left gastric artery', ['alimentary-system']), ['cardiovascular']);
  assert.deepEqual(of('vein', 'renal vein'), ['cardiovascular']);
  assert.deepEqual(of('nerve', 'optic nerve'), ['nervous']);
  assert.deepEqual(of('lymphatic', 'thoracic duct'), ['lymphatic']);
});

test('CNS and skin give their system only as a fallback', () => {
  assert.deepEqual(of('cns', 'thalamus'), ['nervous']);
  assert.deepEqual(of('skin', 'skin'), ['integumentary']);
  assert.deepEqual(of('cns', 'pituitary gland'), ['endocrine']);
});

test('regions and groups have no system', () => {
  assert.deepEqual(of('organ', 'forearm', ['free-upper-limb', 'upper-limb']), []);
  assert.deepEqual(of('organ', 'patellar part of knee'), []);
  assert.deepEqual(of('group', 'body wall'), []);
});

test('names that contain another system word: the cricothyroid ligament is laryngeal, not endocrine', () => {
  assert.deepEqual(of('ligament', 'median cricothyroid ligament'), ['respiratory']);
  assert.deepEqual(of('organ', 'thyrohyoid membrane'), ['respiratory']);
  assert.deepEqual(of('organ', 'left lobe of thyroid gland'), ['endocrine']);
});

test('eye adnexa, hair and breast parts', () => {
  assert.deepEqual(of('organ', 'corona ciliaris'), ['sensory']);
  assert.deepEqual(of('organ', 'common tendinous ring'), ['sensory']);
  assert.deepEqual(of('organ', 'eyebrow'), ['integumentary']);
  for (const name of ['nipple', 'female areola', 'areolar tubercle', 'lactiferous sinus', 'main lactiferous duct']) assert.deepEqual(of('organ', name), ['genital'], name);
});

test('keyword false positives found on the real data', () => {
  assert.deepEqual(of('fascia', 'flexor retinaculum of wrist'), ['muscular']); // "retina" inside "retinaculum"
  assert.deepEqual(of('muscle', 'digastric'), ['muscular']); // "gastr" inside "digastric"
  assert.deepEqual(of('organ', 'pancreatic duct'), ['digestive']); // the exocrine pancreas is not endocrine
  assert.deepEqual(of('bone', 'lacrimal bone'), ['skeletal']);
  assert.deepEqual(of('bone', 'palatine bone'), ['skeletal']);
  assert.deepEqual(of('organ', 'lacrimal gland'), ['sensory']);
  assert.deepEqual(of('organ', 'hard palate'), ['digestive']);
  assert.deepEqual(of('cartilage', 'lateral nasal cartilage'), ['respiratory']);
});
