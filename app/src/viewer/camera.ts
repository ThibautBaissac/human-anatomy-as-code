// Camera presets, default framing and glides. Pure. BodyParts3D frame: +x the body's left, −y its front, +z up.
import type { Camera, Vec3 } from './types.ts';

export type Preset = 'front' | 'back' | 'left' | 'right' | 'top';
export const PRESETS: Preset[] = ['front', 'back', 'left', 'right', 'top'];
/** Duration of a camera glide (ms). */
export const GLIDE_MS = 400;

// Top: straight down would leave the orbit's up axis undefined; a hair behind the vertical puts the face at the top of the screen.
const DIRECTIONS: Record<Preset, Vec3> = {
  front: [0, -1, 0], back: [0, 1, 0], left: [1, 0, 0], right: [-1, 0, 0], top: normalize([0, 0.01, 1]),
};

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(...v);
  return [v[0] / n, v[1] / n, v[2] / n];
}
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Looks at the same target from the same distance, from the named side of the body. */
export function presetCamera(preset: Preset, cam: Camera): Camera {
  const d = Math.hypot(...sub(cam.position, cam.target));
  const dir = DIRECTIONS[preset];
  const t = cam.target;
  // + 0 turns −0 into 0: a preset position compares equal to the one written by hand
  return { position: [t[0] + dir[0] * d + 0, t[1] + dir[1] * d + 0, t[2] + dir[2] * d + 0], target: [...t] };
}

/**
 * The whole body, from the front, centred on its bounding box (the first view).
 * `free`: the share of the canvas height left free by the panels over it; the camera steps back so the body fits in it.
 */
export function defaultCamera(box: { min: Vec3; max: Vec3 }, free = 1): Camera {
  const size = sub(box.max, box.min);
  const centre: Vec3 = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const dist = (Math.max(...size) * 1.6) / Math.min(Math.max(free, 0.3), 1);
  return { position: [centre[0], centre[1] - dist, centre[2] + size[2] * 0.1], target: centre };
}

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Camera at eased time t (0..1) between two cameras: the target moves straight, the camera goes round it
 * (azimuth the short way, elevation and distance linear), so a glide from front to back never passes through the body.
 */
export function interpolateCamera(from: Camera, to: Camera, t: number): Camera {
  if (t <= 0) return from;
  const e = easeInOutCubic(Math.min(t, 1));
  const target: Vec3 = [lerp(from.target[0], to.target[0], e), lerp(from.target[1], to.target[1], e), lerp(from.target[2], to.target[2], e)];
  const a = spherical(sub(from.position, from.target)), b = spherical(sub(to.position, to.target));
  let dTheta = b.theta - a.theta;
  if (dTheta > Math.PI) dTheta -= 2 * Math.PI;
  else if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
  const r = lerp(a.r, b.r, e), theta = a.theta + dTheta * e, phi = lerp(a.phi, b.phi, e);
  const offset: Vec3 = [r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)];
  return { position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]], target };
}

function spherical([x, y, z]: Vec3) {
  const r = Math.hypot(x, y, z) || 1;
  return { r, theta: Math.atan2(y, x), phi: Math.acos(Math.min(Math.max(z / r, -1), 1)) };
}

/** Room taken over the canvas by the interface, in CSS pixels from each edge. */
export interface Insets { top: number; right: number; bottom: number; left: number }
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** Share of the canvas width and height left free by the insets (never below 30 %). */
export function freeShare(width: number, height: number, i: Insets): { x: number; y: number } {
  return { x: Math.max((width - i.left - i.right) / width, 0.3), y: Math.max((height - i.top - i.bottom) / height, 0.3) };
}

/**
 * How far the picture moves so that the centre of the scene lands in the centre of the free area (CSS px, + right / + down).
 * Applied as a view offset of the projection: the camera and its target do not move.
 */
export const centreShift = (i: Insets): { x: number; y: number } => ({ x: (i.left - i.right) / 2, y: (i.top - i.bottom) / 2 });

/** Camera distance at which a sphere of this radius fits in the free area (with a 10 % margin). */
export function fitDistance(radius: number, fovDeg: number, aspect: number, free: { x: number; y: number }): number {
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360) * Math.min(free.y, free.x * aspect);
  return (radius / Math.sin(Math.atan(tanHalf))) * 1.1;
}

/**
 * What a click selection needs so the user sees it: `pan` when its centre lies outside the free area
 * (under a panel, off screen), `frame` when it is under 8 px across, else nothing.
 */
export function revealNeed(centre: { x: number; y: number }, radiusPx: number, area: { left: number; top: number; right: number; bottom: number }): 'pan' | 'frame' | null {
  if (radiusPx < 4) return 'frame';
  const inside = centre.x >= area.left && centre.x <= area.right && centre.y >= area.top && centre.y <= area.bottom;
  return inside ? null : 'pan';
}
