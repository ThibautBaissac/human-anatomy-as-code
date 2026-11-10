import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCamera, easeInOutCubic, interpolateCamera, presetCamera } from '../src/viewer/camera.ts';
import type { Camera } from '../src/viewer/types.ts';

// BodyParts3D frame: +x is the body's left, −y its front, +z up.
const near = (a: number[], b: number[], eps = 1e-6) => a.every((x, i) => Math.abs(x - b[i]) < eps);
const front: Camera = { position: [0, -500, 1000], target: [0, 0, 1000] };

test('presets keep the target and the distance and look from the named side of the body', () => {
  assert.deepEqual(presetCamera('back', front), { position: [0, 500, 1000], target: [0, 0, 1000] });
  assert.ok(near(presetCamera('left', front).position, [500, 0, 1000]));
  assert.ok(near(presetCamera('right', front).position, [-500, 0, 1000]));
  const elbow: Camera = { position: [300, -200, 1100], target: [200, -60, 1050] };
  const d = Math.hypot(100, -140, 50);
  const p = presetCamera('front', elbow);
  assert.deepEqual(p.target, elbow.target);
  assert.ok(near(p.position, [200, -60 - d, 1050]));
});

test('the top preset looks down, a hair behind the vertical so that the face is at the top of the screen', () => {
  const { position: [x, y, z], target } = presetCamera('top', front);
  assert.deepEqual(target, [0, 0, 1000]);
  assert.ok(Math.abs(Math.hypot(x, y, z - 1000) - 500) < 1e-6);
  assert.equal(x, 0);
  assert.ok(y > 0 && y < 10, `y ${y}`);
  assert.ok(z > 1499);
});

test('the default framing: the whole body from the front, centred on its box', () => {
  const cam = defaultCamera({ min: [-300, -150, 0], max: [300, 150, 1700] });
  assert.deepEqual(cam.target, [0, 0, 850]);
  assert.deepEqual(cam.position, [0, -1700 * 1.6, 850 + 170]);
});

test('easing: ends fixed, symmetric, monotone', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  for (let t = 0; t < 1; t += 0.05) assert.ok(easeInOutCubic(t + 0.05) >= easeInOutCubic(t));
  assert.ok(Math.abs(easeInOutCubic(0.25) + easeInOutCubic(0.75) - 1) < 1e-12);
});

test('interpolation goes round the target, never through it: half way from front to back is at the side', () => {
  const back = presetCamera('back', front);
  assert.deepEqual(interpolateCamera(front, back, 0), front);
  assert.ok(near(interpolateCamera(front, back, 1).position, back.position));
  const mid = interpolateCamera(front, back, 0.5);
  const [x, y, z] = mid.position;
  assert.ok(Math.abs(Math.hypot(x, y, z - 1000) - 500) < 1e-6, 'distance kept');
  assert.ok(Math.abs(y) < 1e-6 && Math.abs(Math.abs(x) - 500) < 1e-6, `at the side: ${mid.position}`);
});

test('interpolation moves the target and the distance linearly in eased time', () => {
  const to: Camera = { position: [0, -1000, 500], target: [0, 0, 500] };
  const mid = interpolateCamera(front, to, 0.5);
  assert.ok(near(mid.target, [0, 0, 750]));
  assert.ok(Math.abs(Math.hypot(mid.position[0], mid.position[1], mid.position[2] - 750) - 750) < 1e-6);
});

test('interpolation takes the short way round', () => {
  const left = presetCamera('left', front), right = presetCamera('right', front);
  const a = interpolateCamera(front, left, 0.5).position, b = interpolateCamera(front, right, 0.5).position;
  assert.ok(a[0] > 0 && a[1] < 0, `front→left passes front-left: ${a}`);
  assert.ok(b[0] < 0 && b[1] < 0, `front→right passes front-right: ${b}`);
});
