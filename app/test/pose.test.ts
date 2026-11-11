import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMatrix, crossingInstances, jointMatrix, jointsFor, lengthTrend, poseMatrices, type Pose, type Rigs } from '../src/viewer/pose.ts';
import { decodeView, encodeView } from '../src/viewer/view-hash.ts';
import { DEFAULT_VIEW, type AtlasJoint, type AtlasStructure } from '../src/viewer/types.ts';

type V = [number, number, number];
const closeVec = (a: V, b: V, tol = 1e-6) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= tol, `${a} ≠ ${b}`));
const L = (text: string) => ({ en: { text, source: 'curated', status: 'draft' as const } });

// Left elbow at (0, 0, 1000), flexion around −X: the forearm goes forward (−Y). Rest pose: 10° of flexion.
const ELBOW: AtlasJoint = {
  slug: 'elbow-joint', labels: L('elbow joint'), motion: 'flexion-extension', proximal: 'humerus', moving: ['ulna', 'radius'],
  rangeDeg: [0, 145], restDeg: 10, functionalArcDeg: [30, 130], sources: [], status: 'draft',
  sides: { left: { centre: [0, 0, 1000], axis: [-1, 0, 0], rmsMm: 1 }, right: { centre: [-400, 0, 1000], axis: [-1, 0, 0], rmsMm: 1 } },
};
// Forearm rotation of the left side around the vertical line x = 30 through (30, 0, 800), applied after the elbow.
const FOREARM: AtlasJoint = {
  slug: 'radio-ulnar-joints', labels: L('radio-ulnar joints'), motion: 'pronation-supination', proximal: 'ulna', moving: ['radius'], parent: 'elbow-joint',
  rangeDeg: [-85, 77], restDeg: -85, sources: [], status: 'draft',
  sides: { left: { centre: [30, 0, 800], axis: [0, 0, 1], rmsMm: 1 } },
};
const KNEE: AtlasJoint = {
  slug: 'knee-joint', labels: L('knee joint'), motion: 'flexion-extension', proximal: 'femur', moving: ['tibia'], coupled: [{ bone: 'patella', ratio: 0.5 }],
  rangeDeg: [0, 138], restDeg: 0, sources: [], status: 'draft',
  sides: { left: { centre: [0, 0, 400], axis: [1, 0, 0], rmsMm: 1 } },
};
const JOINTS = [ELBOW, FOREARM, KNEE];
const RIGS: Rigs = {
  'elbow-joint@left': { moving: ['hand@left', 'radius@left', 'ulna@left'], coupled: [], crossing: ['biceps@left', 'skin'],
    muscles: [{ name: 'biceps@left', slug: 'biceps', role: 'flexion', momentArmMm: -18 }] },
  'elbow-joint@right': { moving: ['ulna@right'], coupled: [], crossing: ['biceps@right'], muscles: [] },
  'radio-ulnar-joints@left': { moving: ['hand@left', 'radius@left'], coupled: [], crossing: ['pronator@left'], muscles: [] },
  'knee-joint@left': { moving: ['tibia@left'], coupled: [{ name: 'patella@left', ratio: 0.5 }], crossing: ['quadriceps@left'], muscles: [] },
};

test('a joint matrix turns a point by angle − rest around the side axis through the centre', () => {
  // ulna tip 100 mm below the elbow; at 100° the forearm has turned 90° from rest, forward
  const m = jointMatrix(JOINTS, 'elbow-joint', 'left', { 'elbow-joint@left': 100 });
  closeVec(applyMatrix(m, [0, 0, 900]), [0, -100, 1000]);
});

test('at the rest angle, or absent from the pose, a joint does not move anything', () => {
  for (const pose of [{}, { 'elbow-joint@left': 10 }] as Pose[]) closeVec(applyMatrix(jointMatrix(JOINTS, 'elbow-joint', 'left', pose), [5, 6, 7]), [5, 6, 7]);
  assert.deepEqual(poseMatrices(JOINTS, RIGS, {}).size, 0);
});

test('poseMatrices: moving instances turn with their joint, the other side stays still', () => {
  const m = poseMatrices(JOINTS, RIGS, { 'elbow-joint@left': 100 });
  assert.deepEqual([...m.keys()].sort(), ['hand@left', 'radius@left', 'ulna@left']);
  closeVec(applyMatrix(m.get('ulna@left')!, [0, 0, 900]), [0, -100, 1000]);
});

test('a child joint composes with its parent: pronation of a flexed elbow', () => {
  // radius point 30 mm beside the forearm axis at the wrist; supination (rest −85) → neutral (0): +85° around +Z, then the elbow at 100°
  const m = poseMatrices(JOINTS, RIGS, { 'elbow-joint@left': 100, 'radio-ulnar-joints@left': 0 });
  const p: V = [60, 0, 800];
  const rot = (deg: number, [x, y, z]: V, [cx, cy]: [number, number]): V => {
    const t = (deg * Math.PI) / 180;
    return [cx + (x - cx) * Math.cos(t) - (y - cy) * Math.sin(t), cy + (x - cx) * Math.sin(t) + (y - cy) * Math.cos(t), z];
  };
  const afterForearm = rot(85, p, [30, 0]);
  const elbowOnly = jointMatrix(JOINTS, 'elbow-joint', 'left', { 'elbow-joint@left': 100 });
  closeVec(applyMatrix(m.get('radius@left')!, p), applyMatrix(elbowOnly, afterForearm));
  // the ulna follows the elbow only
  closeVec(applyMatrix(m.get('ulna@left')!, p), applyMatrix(elbowOnly, p));
});

test('a coupled bone turns by ratio × (angle − rest) around the same axis', () => {
  const m = poseMatrices(JOINTS, RIGS, { 'knee-joint@left': 90 });
  // patella 40 mm in front of the knee: 45° of flexion around +X
  const c = Math.SQRT1_2 * 40;
  closeVec(applyMatrix(m.get('patella@left')!, [0, -40, 400]), [0, -c, 400 - c]);
});

test('crossing instances: those of joints away from rest, and of joints playing even at rest', () => {
  assert.deepEqual([...crossingInstances(RIGS, JOINTS, {})].sort(), []);
  assert.deepEqual([...crossingInstances(RIGS, JOINTS, { 'elbow-joint@left': 90 })].sort(), ['biceps@left', 'skin']);
  assert.deepEqual([...crossingInstances(RIGS, JOINTS, {}, new Set(['knee-joint@left']))].sort(), ['quadriceps@left']);
});

test('lengthTrend: from the moment arm and the direction of motion; stable when small; none against the declared role', () => {
  assert.equal(lengthTrend({ role: 'flexion', momentArmMm: -18 }, 1), 'shortens');
  assert.equal(lengthTrend({ role: 'flexion', momentArmMm: -18 }, -1), 'lengthens');
  assert.equal(lengthTrend({ role: 'extension', momentArmMm: 20 }, 1), 'lengthens');
  assert.equal(lengthTrend({ role: 'flexion', momentArmMm: 2 }, 1), 'stable');
  // geometry says the flexor lengthens in flexion: unknown rather than wrong
  assert.equal(lengthTrend({ role: 'flexion', momentArmMm: 27 }, 1), null);
});

test('jointsFor: the joints a structure takes part in, as a bone or through its actions', () => {
  const s = (slug: string, actions?: AtlasStructure['actions']) => ({ slug, actions }) as AtlasStructure;
  assert.deepEqual(jointsFor(JOINTS, s('humerus')).map((j) => j.slug), ['elbow-joint']);
  assert.deepEqual(jointsFor(JOINTS, s('radius')).map((j) => j.slug), ['elbow-joint', 'radio-ulnar-joints']);
  assert.deepEqual(jointsFor(JOINTS, s('patella')).map((j) => j.slug), ['knee-joint']);
  assert.deepEqual(jointsFor(JOINTS, s('supinator', [{ joint: 'radio-ulnar-joints', role: 'supination', source: 'x', status: 'draft' }])).map((j) => j.slug), ['radio-ulnar-joints']);
  assert.deepEqual(jointsFor(JOINTS, s('heart')), []);
});

test('the pose round-trips through the URL hash; rest angles are not written', () => {
  const ctx = { hasSlug: () => true, kinds: [], maxLayer: 5, joints: JOINTS };
  const hash = encodeView({ ...DEFAULT_VIEW, pose: { 'knee-joint@left': 45, 'elbow-joint@left': 90 } });
  assert.equal(hash, 'p=elbow-joint@left:90,knee-joint@left:45');
  assert.deepEqual(decodeView(hash, ctx).pose, { 'elbow-joint@left': 90, 'knee-joint@left': 45 });
});

test('pose decoding: unknown joints or sides are dropped, angles are rounded and clamped, rest is dropped', () => {
  const ctx = { hasSlug: () => true, kinds: [], maxLayer: 5, joints: JOINTS };
  assert.deepEqual(decodeView('p=hip-joint@left:30,knee-joint@right:30,elbow-joint@left:200,knee-joint@left:44.6', ctx).pose,
    { 'elbow-joint@left': 145, 'knee-joint@left': 45 });
  assert.equal(decodeView('p=elbow-joint@left:10', ctx).pose, undefined);
  assert.equal(decodeView('p=elbow-joint@left:abc', ctx).pose, undefined);
  assert.equal(decodeView('p=elbow-joint@left@x:90', ctx).pose, undefined);
});

test('a whole-degree angle within half a degree of a fractional rest angle is the rest pose', () => {
  const joints = [{ ...ELBOW, restDeg: 13.1 }, FOREARM, KNEE];
  assert.equal(poseMatrices(joints, RIGS, { 'elbow-joint@left': 13 }).size, 0);
  assert.equal(crossingInstances(RIGS, joints, { 'elbow-joint@left': 13 }).size, 0);
  const ctx = { hasSlug: () => true, kinds: [], maxLayer: 5, joints };
  assert.equal(decodeView('p=elbow-joint@left:13', ctx).pose, undefined);
});

test('normaliseAngle: whole degrees within the range, null at rest', async () => {
  const { normaliseAngle } = await import('../src/viewer/pose.ts');
  const elbow = { ...ELBOW, restDeg: 13.1 };
  assert.equal(normaliseAngle(elbow, 89.6), 90);
  assert.equal(normaliseAngle(elbow, 200), 145);
  assert.equal(normaliseAngle(elbow, -5), 0);
  assert.equal(normaliseAngle(elbow, 13), null);
});

test('musclesOf: muscles acting on a joint, movers of the positive direction first, with their rig entry', async () => {
  const { musclesOf } = await import('../src/viewer/pose.ts');
  const act = (joint: string, role: string) => [{ joint, role, source: 'x', status: 'draft' }];
  const structures = [
    { slug: 'triceps', labels: L('triceps'), actions: act('elbow-joint', 'extension') },
    { slug: 'biceps', labels: L('biceps'), actions: act('elbow-joint', 'flexion') },
    { slug: 'brachialis', labels: L('brachialis'), actions: act('elbow-joint', 'flexion') },
    { slug: 'gracilis', labels: L('gracilis'), actions: act('knee-joint', 'flexion') },
  ] as unknown as AtlasStructure[];
  const list = musclesOf(ELBOW, structures, RIGS['elbow-joint@left'], 'en');
  assert.deepEqual(list.map((m) => [m.structure.slug, m.role, m.rig?.momentArmMm]), [['biceps', 'flexion', -18], ['brachialis', 'flexion', undefined], ['triceps', 'extension', undefined]]);
});

test('lengthTrend: forearm rotation has small moment arms, so its stable threshold is lower (1 mm/rad)', () => {
  assert.equal(lengthTrend({ role: 'pronation', momentArmMm: -1.8 }, 1, 'pronation-supination'), 'shortens');
  assert.equal(lengthTrend({ role: 'supination', momentArmMm: 3.5 }, 1, 'pronation-supination'), 'lengthens');
  assert.equal(lengthTrend({ role: 'pronation', momentArmMm: 0.6 }, 1, 'pronation-supination'), 'stable');
  assert.equal(lengthTrend({ role: 'flexion', momentArmMm: -1.8 }, 1, 'flexion-extension'), 'stable');
});

test('motionDirection: the way the angle last moved; before any move, away from rest', async () => {
  const { motionDirection } = await import('../src/viewer/pose.ts');
  assert.equal(motionDirection(null, 90, 13), 1);
  assert.equal(motionDirection(null, 0, 13), -1);
  assert.equal(motionDirection({ angle: 90, direction: 1 }, 60, 13), -1); // dragged back towards extension
  assert.equal(motionDirection({ angle: 60, direction: -1 }, 60, 13), -1); // unchanged: keeps the last direction
  assert.equal(motionDirection({ angle: 60, direction: -1 }, 70, 13), 1);
});
