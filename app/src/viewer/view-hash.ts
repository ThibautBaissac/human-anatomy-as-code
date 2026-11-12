// View ⇄ URL hash, for deep links. Pure. Unknown or invalid values are dropped one by one.
import { parseSelectionKey, selectionKey } from './catalog.ts';
import { normaliseAngle, parseJointKey } from './pose.ts';
import { AXES, DEFAULT_HIDDEN_SYSTEMS, DEFAULT_VIEW, LANGS, sameSystems, type AtlasJoint, type Axis, type Lang, type Side, type ViewState } from './types.ts';

export interface DecodeContext {
  hasSlug(slug: string): boolean;
  /** true when the structure is bilateral; when given, a side on any other structure is invalid */
  hasSides?(slug: string): boolean;
  kinds: string[];
  /** known systems (the whole vocabulary, so that sys= survives a model switch): any other in sys= is dropped */
  systems?: string[];
  maxLayer: number;
  /** joints of the model: a pose on any other joint or side is dropped */
  joints?: AtlasJoint[];
}

const round = (n: number) => Math.round(n);

export function encodeView(v: ViewState): string {
  const p: string[] = [];
  if (v.model === 'female') p.push('sex=f');
  if (v.selection) p.push(`sel=${v.selection.slug}${v.selection.side ? `@${v.selection.side}` : ''}`);
  if (v.layerCut) p.push(`layer=${v.layerCut}`);
  if (v.ghost) p.push('ghost=1');
  if (v.hiddenKinds.length) p.push(`hide=${[...v.hiddenKinds].sort().join(',')}`);
  // absent sys= is the default (skeleton only); no hidden system at all is sys=none
  const sys = v.hiddenSystems ?? [];
  if (!sameSystems(sys, DEFAULT_HIDDEN_SYSTEMS)) p.push(`sys=${sys.length ? [...sys].sort().join(',') : 'none'}`);
  const cuts = AXES.filter((a) => v.sections[a] !== undefined).map((a) => `${a}:${v.sections[a]!.toFixed(3)}`);
  if (cuts.length) p.push(`cut=${cuts.join(',')}`);
  if (v.lang !== 'fr') p.push(`lang=${v.lang}`);
  const pose = Object.keys(v.pose ?? {}).sort();
  if (pose.length) p.push(`p=${pose.map((k) => `${k}:${v.pose[k]}`).join(',')}`);
  if (v.isolated) p.push(`iso=${selectionKey(v.isolated)}`);
  if (v.network) p.push(`net=${selectionKey(v.network)}`);
  if (v.hidden?.length) p.push(`hid=${v.hidden.join(',')}`);
  if (v.camera) p.push(`cam=${[...v.camera.position, ...v.camera.target].map(round).join(',')}`);
  return p.join('&');
}

export function decodeView(hash: string, ctx: DecodeContext): Partial<ViewState> {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const out: Partial<ViewState> = {};
  const sex = params.get('sex');
  if (sex === 'f') out.model = 'female';
  else if (sex === 'm') out.model = 'male';

  // a structure-side: known structure, and a side only on a bilateral one
  const structureSide = (key: string) => {
    const s = parseSelectionKey(key);
    return s && ctx.hasSlug(s.slug) && (!s.side || (ctx.hasSides?.(s.slug) ?? true)) ? s : null;
  };
  const sel = params.get('sel');
  const selection = sel ? structureSide(sel) : null;
  if (selection) out.selection = selection;
  const iso = params.get('iso');
  const isolated = iso ? structureSide(iso) : null;
  if (isolated) out.isolated = isolated;
  // the isolation wins when both are given
  const net = params.get('net');
  const network = net && !isolated ? structureSide(net) : null;
  if (network) out.network = network;
  const hid = params.get('hid');
  if (hid) {
    const hidden = [...new Set(hid.split(',').filter((k) => structureSide(k)))];
    if (hidden.length) out.hidden = hidden;
  }
  const layer = Number(params.get('layer'));
  if (params.has('layer') && Number.isInteger(layer) && layer >= 0 && layer <= ctx.maxLayer) out.layerCut = layer;
  if (params.get('ghost') === '1') out.ghost = true;
  const hide = params.get('hide');
  if (hide) {
    const kinds = hide.split(',').filter((k) => ctx.kinds.includes(k));
    if (kinds.length) out.hiddenKinds = kinds;
  }
  const sys = params.get('sys');
  if (sys === 'none') out.hiddenSystems = [];
  else if (sys && ctx.systems) {
    const systems = [...new Set(sys.split(',').filter((x) => ctx.systems!.includes(x)))].sort();
    if (systems.length) out.hiddenSystems = systems;
  }
  const cut = params.get('cut');
  if (cut) {
    const sections: Partial<Record<Axis, number>> = {};
    for (const part of cut.split(',')) {
      const [axis, pos] = part.split(':');
      const n = Number(pos);
      if (AXES.includes(axis as Axis) && pos !== undefined && Number.isFinite(n) && n >= 0 && n <= 1) sections[axis as Axis] = n;
    }
    if (Object.keys(sections).length) out.sections = sections;
  }
  const lang = params.get('lang');
  if (lang && LANGS.includes(lang as Lang)) out.lang = lang as Lang;
  const p = params.get('p');
  if (p && ctx.joints) {
    const pose: Record<string, number> = {};
    for (const part of p.split(',')) {
      const [key, deg] = part.split(':');
      const { slug, side } = parseJointKey(key);
      const j = ctx.joints.find((x) => x.slug === slug);
      const n = Number(deg);
      // a key with more segments (`elbow-joint@left@x`) would be kept and written back forever
      if (!j || key !== `${slug}@${side}` || (side !== 'left' && side !== 'right') || !j.sides?.[side] || deg === undefined || deg === '' || !Number.isFinite(n)) continue;
      const angle = normaliseAngle(j, n);
      if (angle !== null) pose[key] = angle;
    }
    if (Object.keys(pose).length) out.pose = pose;
  }
  const cam = params.get('cam')?.split(',').map(Number);
  if (cam && cam.length === 6 && cam.every(Number.isFinite)) {
    const r = cam.map(round);
    out.camera = { position: [r[0], r[1], r[2]], target: [r[3], r[4], r[5]] };
  }
  return out;
}

/** The full view a hash describes: absent parameters take their defaults; an absent camera keeps the current one. */
export function viewFromHash(decoded: Partial<ViewState>, current: ViewState): ViewState {
  return { ...DEFAULT_VIEW, camera: current.camera, ...decoded };
}
