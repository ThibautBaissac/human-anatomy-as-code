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
}

export type Model = 'male' | 'female';
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
  layer?: number;
  aliases?: string[];
  labels: Labels;
  ids?: Ids;
  sides?: Record<Side, SideBlock>;
  meshes?: string[];
  variants?: { female?: Variant };
}

export interface Source {
  id: string;
  name: string;
  version: string;
  url: string;
  licence: string;
  attribution: string;
  provides: ('meshes' | 'labels' | 'ids')[];
  meshPrefix?: string;
  meshPattern?: string;
  notes?: string;
  /** organ → DOI, credited per organ (HRA) */
  dois?: Record<string, string>;
}
