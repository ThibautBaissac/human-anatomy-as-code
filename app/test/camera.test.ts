import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centreShift, defaultCamera, easeInOutCubic, fitDistance, freeShare, interpolateCamera, presetCamera, revealNeed } from '../src/viewer/camera.ts';
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

test('the default framing steps back by the share of the height the panels leave free (never past 30 %)', () => {
  const box = { min: [-300, -150, 0] as [number, number, number], max: [300, 150, 1700] as [number, number, number] };
  assert.ok(Math.abs(defaultCamera(box, 0.8).position[1] - (-1700 * 1.6) / 0.8) < 1e-9);
  assert.deepEqual(defaultCamera(box, 0.1).position, defaultCamera(box, 0.3).position);
});

test('free share and centre shift: a 300 px drawer on the left moves the picture 150 px right', () => {
  const i = { top: 60, right: 0, bottom: 100, left: 300 };
  assert.deepEqual(freeShare(1200, 800, i), { x: 0.75, y: 0.8 });
  assert.deepEqual(centreShift(i), { x: 150, y: -20 });
  assert.deepEqual(freeShare(400, 800, { top: 0, right: 0, bottom: 0, left: 390 }), { x: 0.3, y: 1 });
});

test('fit distance: a smaller free area or a narrow window puts the camera further away', () => {
  const full = fitDistance(100, 35, 1.5, { x: 1, y: 1 });
  assert.ok(Math.abs(full - (100 / Math.sin(Math.atan(Math.tan((17.5 * Math.PI) / 180)))) * 1.1) < 1e-9);
  assert.ok(fitDistance(100, 35, 1.5, { x: 1, y: 0.5 }) > full);
  // a phone in portrait: the width limits
  assert.ok(fitDistance(100, 35, 0.5, { x: 1, y: 1 }) > full);
});

test('reveal: nothing inside the free area, pan when under a panel, frame when tiny', () => {
  const area = { left: 0, top: 60, right: 900, bottom: 700 };
  assert.equal(revealNeed({ x: 400, y: 300 }, 30, area), null);
  assert.equal(revealNeed({ x: 1000, y: 300 }, 30, area), 'pan');
  assert.equal(revealNeed({ x: 400, y: 30 }, 30, area), 'pan');
  assert.equal(revealNeed({ x: 400, y: 300 }, 2, area), 'frame');
});
