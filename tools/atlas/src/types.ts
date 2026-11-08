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

export interface Structure {
  slug: string;
  kind: string;
  laterality: 'bilateral' | 'midline' | 'unpaired-left' | 'unpaired-right';
  status: Status;
  parent?: string;
  regions?: string[];
  layer?: number;
  aliases?: string[];
  labels: Labels;
  ids?: Ids;
  sides?: Record<Side, SideBlock>;
  meshes?: string[];
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
}
