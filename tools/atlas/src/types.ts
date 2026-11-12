export type Lang = 'en' | 'fr' | 'la';
export type Side = 'left' | 'right';
export type Status = 'draft' | 'reviewed';

export interface Label {
  text: string;
  source: string;
  status: Status;
  gender?: 'm' | 'f' | 'n';
  number?: 'sg' | 'pl';
  synonyms?: string[];
  description?: string;
}

export type Labels = Partial<Record<Lang, Label>>;

export interface Ids {
  fma?: number;
  ta2?: number;
  ta98?: string;
  uberon?: string;
  wikidata?: string;
}

export interface SideBlock {
  ids?: Ids;
  meshes?: string[];
  labels?: Labels;
  relations?: Relation[];
}

export type Model = 'male' | 'female';

/** Anatomical systems, in display order (spec 2026-11-09-systemes). The app keeps a copy (app/src/viewer/types.ts). */
export const SYSTEMS = ['skeletal', 'muscular', 'cardiovascular', 'lymphatic', 'nervous', 'sensory', 'respiratory', 'digestive', 'urinary', 'genital', 'endocrine', 'integumentary'] as const;
export type System = (typeof SYSTEMS)[number];
export const MODELS: Model[] = ['male', 'female'];

/** How a shared structure differs in the female model: other meshes, or absent. */
export interface Variant {
  hidden?: true;
  meshes?: string[];
  sides?: Partial<Record<Side, { meshes?: string[] }>>;
}

export interface Structure {
  slug: string;
  kind: string;
  laterality: 'bilateral' | 'midline' | 'unpaired-left' | 'unpaired-right';
  status: Status;
  /** only in this model; absent = in both */
  sex?: Model;
  parent?: string;
  regions?: string[];
  /** anatomical systems, in vocabulary order */
  systems?: System[];
  layer?: number;
  aliases?: string[];
  labels: Labels;
  ids?: Ids;
  sides?: Record<Side, SideBlock>;
  meshes?: string[];
  variants?: { female?: Variant };
  /** roles of a muscle in joint motions */
  actions?: Action[];
  /** anatomical relations to other structures (spec 2026-11-11-relations-anatomiques) */
  relations?: Relation[];
}

export type RelationType = 'branch-of' | 'tributary-of' | 'continuation-of' | 'arterial-supply' | 'innervation';
export const RELATION_TYPES: RelationType[] = ['branch-of', 'tributary-of', 'continuation-of', 'arterial-supply', 'innervation'];
export const TREE_TYPES: RelationType[] = ['branch-of', 'tributary-of', 'continuation-of'];

export interface Relation {
  type: RelationType;
  /** a structure slug, or `wikidata:Q<digits>` for an external target */
  target: string;
  /** `curated` or a source id */
  source: string;
  status: Status;
}

/** A target outside the atlas, named from the registry (data/external-targets.yaml), keyed by bare QID. */
export interface ExternalTarget {
  fma?: number;
  labels: Labels;
  source: string;
  status: Status;
}
export type ExternalTargets = Record<string, ExternalTarget>;

export type Motion = 'flexion-extension' | 'pronation-supination';
export type Role = 'flexion' | 'extension' | 'pronation' | 'supination';
export const ROLES_OF: Record<Motion, Role[]> = {
  'flexion-extension': ['flexion', 'extension'],
  'pronation-supination': ['pronation', 'supination'],
};

export interface Action {
  joint: string;
  role: Role;
  source: string;
  status: Status;
}

export type Vec3 = [number, number, number];

/** Centre and axis of one side of a joint, in mm, measured on our meshes. */
export interface JointSide {
  centre: Vec3;
  axis: Vec3;
  rmsMm: number;
}

/** An animatable joint: one degree of freedom around a measured axis. */
export interface Joint {
  slug: string;
  labels: Labels;
  motion: Motion;
  /** fixed bone */
  proximal: string;
  /** bones that turn with the joint */
  moving: string[];
  /** bones that follow a fraction of the angle around the same axis */
  coupled?: { bone: string; ratio: number }[];
  /** joint whose transform applies first */
  parent?: string;
  rangeDeg: [number, number];
  /** angle of the BodyParts3D pose */
  restDeg: number;
  functionalArcDeg?: [number, number];
  sources: string[];
  status: Status;
  /** measurement parameters (fit-joints) */
  fit: { method: 'cylinder-contact' | 'head-to-head' | 'condyle-spheres'; maxRmsMm: number; positiveDirection: Vec3; [param: string]: unknown };
  sides?: Partial<Record<Side, JointSide>>;
}

export interface Source {
  id: string;
  name: string;
  version: string;
  url: string;
  licence: string;
  attribution: string;
  provides: ('meshes' | 'labels' | 'ids' | 'joints' | 'actions' | 'relations')[];
  meshPrefix?: string;
  meshPattern?: string;
  notes?: string;
  /** organ → DOI, credited per organ (HRA) */
  dois?: Record<string, string>;
  /** licence notice to reproduce (MIT, BSD) */
  notice?: string;
}
