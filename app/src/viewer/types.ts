// Shapes shared by the viewer and the UI. Pure: no three.js, no React, no DOM.
export type Lang = 'fr' | 'en' | 'la';
export type Side = 'left' | 'right';
export type Axis = 'axial' | 'coronal' | 'sagittal';
export type Model = 'male' | 'female';
export const AXES: Axis[] = ['axial', 'coronal', 'sagittal'];
export const LANGS: Lang[] = ['fr', 'en', 'la'];

export interface AtlasLabel {
  text: string;
  source: string;
  status: 'draft' | 'reviewed';
  gender?: string;
  number?: string;
  synonyms?: string[];
}

export interface AtlasSide {
  ids?: Record<string, unknown>;
  meshes?: string[];
  labels: Partial<Record<Lang, string>>;
}

export interface AtlasStructure {
  slug: string;
  kind: string;
  laterality: 'bilateral' | 'midline' | 'unpaired-left' | 'unpaired-right';
  status: 'draft' | 'reviewed';
  parent?: string;
  regions?: string[];
  layer: number | null;
  children: string[];
  aliases?: string[];
  labels: Partial<Record<Lang, AtlasLabel>>;
  ids?: Record<string, unknown>;
  meshes?: string[];
  sides?: Record<Side, AtlasSide>;
  sex?: Model;
  /** roles of a muscle in joint motions */
  actions?: { joint: string; role: Role; source: string; status: 'draft' | 'reviewed' }[];
}

export type Motion = 'flexion-extension' | 'pronation-supination';
export type Role = 'flexion' | 'extension' | 'pronation' | 'supination';
export type Vec3 = [number, number, number];

/** An animatable joint: one degree of freedom around an axis measured on our bones (data/joints). */
export interface AtlasJoint {
  slug: string;
  labels: Partial<Record<Lang, AtlasLabel>>;
  motion: Motion;
  proximal: string;
  moving: string[];
  coupled?: { bone: string; ratio: number }[];
  /** joint whose transform applies first */
  parent?: string;
  rangeDeg: [number, number];
  /** angle of the BodyParts3D pose */
  restDeg: number;
  functionalArcDeg?: [number, number];
  sources: string[];
  status: 'draft' | 'reviewed';
  sides?: Partial<Record<Side, { centre: Vec3; axis: Vec3; rmsMm: number }>>;
}

export interface Atlas {
  structures: AtlasStructure[];
  meshIndex: Record<string, { slug: string; side: Side | null }>;
  attributions: { source: string; name: string; licence: string; attribution: string; url: string; dois?: { organ: string; doi: string }[]; notice?: string }[];
  joints?: AtlasJoint[];
}

export interface Selection {
  slug: string;
  side: Side | null;
}

export interface Camera {
  position: [number, number, number];
  target: [number, number, number];
}

/** Everything a view is made of: what the URL encodes and what the UI renders from. */
export interface ViewState {
  selection: Selection | null;
  layerCut: number;
  ghost: boolean;
  hiddenKinds: string[];
  sections: Partial<Record<Axis, number>>;
  lang: Lang;
  camera: Camera | null;
  model: Model;
  /** joint angles in whole degrees, keyed joint@side; a joint at rest is absent */
  pose: Record<string, number>;
}

export const DEFAULT_VIEW: ViewState = {
  selection: null, layerCut: 0, ghost: false, hiddenKinds: [], sections: {}, lang: 'fr', camera: null, model: 'male', pose: {},
};
