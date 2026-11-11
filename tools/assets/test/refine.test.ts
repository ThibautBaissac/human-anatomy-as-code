import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACET_THRESHOLD, MAX_REFINED_TRIANGLES, medianDihedral, needsRefine, refine } from '../src/refine.ts';
import type { Geometry } from '../src/geometry.ts';

const geo = (positions: number[], indices: number[]): Geometry => ({ positions: new Float32Array(positions), indices: new Uint32Array(indices) });

/** Unit icosahedron, outward triangles. */
function icosahedron(): Geometry {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; });
  const f = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
  return geo(v.flat(), f);
}
const radii = (g: Geometry, from = 0) => {
  const out: number[] = [];
  for (let i = from * 3; i < g.positions.length; i += 3) out.push(Math.hypot(g.positions[i], g.positions[i + 1], g.positions[i + 2]));
  return out;
};

test('refine: four triangles for one, original vertices unchanged, one new vertex per edge', () => {
  const g = icosahedron();
  const r = refine(g);
  assert.equal(r.indices.length, g.indices.length * 4);
  assert.deepEqual(Array.from(r.positions.slice(0, g.positions.length)), Array.from(g.positions));
  assert.equal(r.positions.length / 3, 12 + 30); // 30 edges on an icosahedron
});

test('refine: the new midpoints move from the flat edge towards the sphere the normals describe', () => {
  const g = icosahedron();
  const flatMid = Math.hypot(...[0, 1, 2].map((c) => (g.positions[c] + g.positions[11 * 3 + c]) / 2)); // edge 0–11
  const r = refine(g);
  for (const radius of radii(r, 12)) {
    assert.ok(radius > flatMid + 0.02, `midpoint pulled out: ${radius}`);
    assert.ok(Math.abs(1 - radius) < Math.abs(1 - flatMid), `closer to the sphere: ${radius}`);
  }
});

test('refine: a sharp edge (duplicated vertices) keeps a straight midpoint, the same on both sides: no crack', () => {
  // two triangles folded at 90° along the x axis, their edge vertices duplicated (BodyParts3D sharp edge)
  const g = geo([0, 0, 0, 1, 0, 0, 0.5, 1, 0, /* other side */ 0, 0, 0, 1, 0, 0, 0.5, 0, 1], [0, 1, 2, 4, 3, 5]);
  const r = refine(g);
  const p = (i: number) => Array.from(r.positions.slice(i * 3, i * 3 + 3));
  const onEdge = [...Array(r.positions.length / 3).keys()].slice(6).map(p).filter(([, y, z]) => y === 0 && z === 0);
  assert.equal(onEdge.length, 2, 'one midpoint per side');
  assert.deepEqual(onEdge[0], [0.5, 0, 0]);
  assert.deepEqual(onEdge[1], [0.5, 0, 0]);
});

test('median dihedral angle: 0 on a flat grid, about 41.8° on an icosahedron; open edges left out', () => {
  const grid = geo([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], [0, 1, 2, 1, 3, 2]);
  assert.equal(medianDihedral(grid), 0);
  assert.ok(Math.abs(medianDihedral(icosahedron()) - 41.81) < 0.05);
  assert.equal(medianDihedral(geo([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2])), 0);
});

test('needsRefine: listed kinds (female files too), light and past the threshold only', () => {
  const faceted = icosahedron(), flat = geo([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], [0, 1, 2, 1, 3, 2]);
  assert.ok(medianDihedral(faceted) > FACET_THRESHOLD);
  assert.equal(needsRefine('bone', faceted), true);
  assert.equal(needsRefine('female-organ', faceted), true);
  assert.equal(needsRefine('artery', faceted), false);
  assert.equal(needsRefine('bone', flat), false);
  // a dense mesh, however angular, is left alone: enough separate icosahedra to pass the cap
  const copies = Math.ceil((MAX_REFINED_TRIANGLES + 1) / 20);
  const dense = geo(Array.from({ length: copies }, (_, c) => Array.from(faceted.positions, (x, i) => (i % 3 === 0 ? x + 3 * c : x))).flat(),
    Array.from({ length: copies }, (_, c) => Array.from(faceted.indices, (i) => i + 12 * c)).flat());
  assert.ok(dense.indices.length / 3 > MAX_REFINED_TRIANGLES && medianDihedral(dense) > FACET_THRESHOLD);
  assert.equal(needsRefine('bone', dense), false);
});
