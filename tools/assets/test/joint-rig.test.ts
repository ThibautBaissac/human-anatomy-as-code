import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rigJoint, type RigInstance, type RigJoint } from '../src/joints/rig.ts';

/** A box sampled every 5 mm, as the vertices of an instance. */
function box(x: [number, number], y: [number, number], z: [number, number]): Float32Array {
  const out: number[] = [];
  const steps = (r: [number, number]) => { const s: number[] = []; for (let v = r[0]; v <= r[1]; v += 5) s.push(v); if (s[s.length - 1] !== r[1]) s.push(r[1]); return s; };
  for (const a of steps(x)) for (const b of steps(y)) for (const c of steps(z)) out.push(a, b, c);
  return new Float32Array(out);
}
const inst = (name: string, kind: string, limb: RigInstance['limb'], positions: Float32Array): RigInstance => {
  const [slug, side] = name.split('@');
  return { name, slug, side: (side as 'left' | 'right') ?? null, kind, limb, positions };
};

// Left elbow at the origin, flexion around −X (the forearm goes forward, −Y). Upper arm above, forearm below.
const ELBOW: RigJoint = {
  slug: 'elbow-joint', motion: 'flexion-extension', proximal: 'humerus', moving: ['ulna'], rangeDeg: [0, 145], restDeg: 0,
  sides: { left: { centre: [0, 0, 0], axis: [-1, 0, 0] } },
};
const ARM: RigInstance[] = [
  inst('humerus@left', 'bone', 'upper-limb', box([-5, 5], [-5, 5], [5, 300])),
  inst('ulna@left', 'bone', 'upper-limb', box([-5, 5], [-5, 5], [-250, -2])),
  inst('biceps@left', 'muscle', 'upper-limb', box([-5, 5], [-30, -20], [-40, 250])),
  inst('triceps@left', 'muscle', 'upper-limb', box([-5, 5], [20, 30], [-5, 250])), // inserts behind the axis, at its level (olecranon)
  inst('deltoid@left', 'muscle', 'upper-limb', box([-5, 5], [-10, 10], [200, 300])),
  inst('pronator@left', 'muscle', 'upper-limb', box([-5, 5], [-10, 10], [10, 60])),
  inst('hand@left', 'bone', 'upper-limb', box([-10, 10], [-10, 10], [-400, -260])),
  inst('forearm-vein@left', 'vein', 'upper-limb', box([8, 10], [-12, -10], [-240, -20])),
  // reaches 1 mm above the plane: inside the margin, so wholly beyond the joint
  inst('touching@left', 'muscle', 'upper-limb', box([12, 16], [-5, 5], [-200, 1])),
  inst('ulna@right', 'bone', 'upper-limb', box([395, 405], [-5, 5], [-250, -2])),
  inst('foot@left', 'bone', 'lower-limb', box([-10, 10], [-10, 10], [-900, -800])),
  inst('skin', 'skin', null, box([-40, 40], [-40, 40], [-420, 320])),
  // midline skin patch of the other hand: beyond the (infinite) joint plane, but not part of this limb
  inst('skin-of-other-hand', 'skin', null, box([390, 410], [-10, 10], [-400, -260])),
];
const ACTIONS = new Map([
  ['biceps', [{ joint: 'elbow-joint', role: 'flexion' as const }]],
  ['triceps', [{ joint: 'elbow-joint', role: 'extension' as const }]],
  ['pronator', [{ joint: 'elbow-joint', role: 'flexion' as const }]],
]);

test('moving: the listed bones and every limb instance of the same side wholly beyond the joint', () => {
  const { rig } = rigJoint(ELBOW, 'left', ARM, ACTIONS);
  assert.deepEqual(rig.moving, ['forearm-vein@left', 'hand@left', 'touching@left', 'ulna@left']);
});

test('crossing: limb instances with vertices on both sides near the joint, the skin, and the muscles acting on the joint', () => {
  const { rig } = rigJoint(ELBOW, 'left', ARM, ACTIONS);
  // pronator lies above the joint but acts on it: crossing all the same
  assert.deepEqual(rig.crossing, ['biceps@left', 'pronator@left', 'skin', 'triceps@left']);
});

test('instances of the other side, of the other limb, or wholly before the joint stay still', () => {
  const { rig } = rigJoint(ELBOW, 'left', ARM, ACTIONS);
  const touched = new Set([...rig.moving, ...rig.crossing]);
  for (const name of ['ulna@right', 'foot@left', 'deltoid@left', 'humerus@left', 'skin-of-other-hand']) assert.ok(!touched.has(name), name);
});

test('muscles: role and moment arm at rest, negative when the muscle shortens in the positive direction (flexion)', () => {
  const { rig } = rigJoint(ELBOW, 'left', ARM, ACTIONS);
  // pronator acts on the joint but neither touches the moving bone nor reaches past the joint: no moment arm
  assert.deepEqual(rig.muscles.map((m) => [m.name, m.role]), [['biceps@left', 'flexion'], ['triceps@left', 'extension']]);
  const [biceps, triceps] = rig.muscles;
  // biceps: inserts 35 mm below and 25 mm in front of the axis; triceps: 25 mm behind it
  assert.ok(biceps.momentArmMm < -15, `biceps ${biceps.momentArmMm}`);
  assert.ok(triceps.momentArmMm > 15, `triceps ${triceps.momentArmMm}`);
});

test('pronation-supination: the insertion is where the muscle touches the moving bone', () => {
  // forearm: ulna (fixed) on the axis, radius beside it; a muscle wraps in front of the radius from the ulna
  const RU: RigJoint = {
    slug: 'radio-ulnar-joints', motion: 'pronation-supination', proximal: 'ulna', moving: ['radius'], rangeDeg: [-85, 77], restDeg: -85,
    sides: { left: { centre: [0, 0, 0], axis: [0, 0, -1] } },
  };
  const forearm = [
    inst('ulna@left', 'bone', 'upper-limb', box([-4, 4], [-4, 4], [0, 250])),
    inst('radius@left', 'bone', 'upper-limb', box([26, 34], [-4, 4], [-10, 240])),
    inst('pronator-quadratus@left', 'muscle', 'upper-limb', box([5, 30], [-12, -6], [10, 50])),
  ];
  // a hand muscle whose limb is unknown (no region in the data): moves with the radius, inside the capsule over the hand
  forearm.push(inst('lumbrical@left', 'muscle', null, box([20, 30], [-5, 5], [-200, -150])));
  const actions = new Map([['pronator-quadratus', [{ joint: 'radio-ulnar-joints', role: 'pronation' as const }]]]);
  const { rig, warnings } = rigJoint(RU, 'left', forearm, actions);
  assert.deepEqual(rig.crossing, ['pronator-quadratus@left']);
  assert.deepEqual(rig.moving, ['lumbrical@left', 'radius@left']);
  assert.equal(rig.muscles.length, 1);
  assert.ok(Math.abs(rig.muscles[0].momentArmMm) > 1);
  assert.deepEqual(warnings, []);
});

test('coupled bones follow with their ratio and are neither moving nor crossing', () => {
  const knee: RigJoint = { ...ELBOW, coupled: [{ bone: 'hand', ratio: 0.85 }] };
  const { rig } = rigJoint(knee, 'left', ARM, ACTIONS);
  assert.deepEqual(rig.coupled, [{ name: 'hand@left', ratio: 0.85 }]);
  assert.ok(!rig.moving.includes('hand@left') && !rig.crossing.includes('hand@left'));
});

test('a declared role that the length change contradicts is reported', () => {
  const wrong = new Map([...ACTIONS, ['triceps', [{ joint: 'elbow-joint', role: 'flexion' as const }]]]);
  const { warnings } = rigJoint(ELBOW, 'left', ARM, wrong);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /triceps@left.*flexion.*s'allonge/);
  assert.deepEqual(rigJoint(ELBOW, 'left', ARM, ACTIONS).warnings, []);
});

test('a side-less instance (unpaired, midline) lying wholly on one side of the median plane moves with that side only', () => {
  // both elbows in the real frame: subject's left = +x
  const elbows: RigJoint = { ...ELBOW, sides: { left: { centre: [200, 0, 0], axis: [-1, 0, 0] }, right: { centre: [-200, 0, 0], axis: [-1, 0, 0] } } };
  const at = (dx: number) => (b: Float32Array) => b.map((v, i) => (i % 3 === 0 ? v + dx : v));
  const instances: RigInstance[] = [
    ...['left', 'right'].flatMap((side) => {
      const shift = at(side === 'left' ? 200 : -200);
      return [inst(`humerus@${side}`, 'bone', 'upper-limb', shift(box([-5, 5], [-5, 5], [5, 300]))), inst(`ulna@${side}`, 'bone', 'upper-limb', shift(box([-5, 5], [-5, 5], [-250, -2])))];
    }),
    // unpaired-right finger artery (BodyParts3D names one side only): right hand, x < 0
    inst('finger-artery', 'artery', 'upper-limb', box([-205, -195], [-5, 5], [-300, -280])),
    // a midline structure astride the median plane never moves with a limb
    inst('midline-vein', 'vein', 'upper-limb', box([-210, 210], [-5, 5], [-300, -280])),
  ];
  const right = rigJoint(elbows, 'right', instances, new Map()).rig;
  const left = rigJoint(elbows, 'left', instances, new Map()).rig;
  assert.deepEqual(right.moving, ['finger-artery', 'ulna@right']);
  assert.deepEqual(left.moving, ['ulna@left']);
  for (const r of [left, right]) assert.ok(![...r.moving, ...r.crossing].includes('midline-vein'));
});
