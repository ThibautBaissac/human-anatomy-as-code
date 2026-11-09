// BodyParts3D 4.0 + Wikidata → data/structures/<kind>/<slug>.yaml
// Bootstrap once, then re-run safely: YAML is authoritative, reviewed data is never touched,
// no file is ever deleted or overwritten by another structure.
import { readBp3d } from './import/bp3d.ts';
import { readWikidata } from './import/wikidata.ts';
import { planStructures, type Overrides, type Plan } from './import/plan.ts';
import { applyPlan, type ApplyReport } from './import/apply-plan.ts';

export type { Overrides } from './import/plan.ts';

export type ImportReport = Omit<Plan, 'structures'> & ApplyReport;

export interface ImportOptions {
  bp3dDir: string;
  wikidataCsv: string;
  dataDir: string;
  overrides?: Overrides;
}

export function importBp3d({ bp3dDir, wikidataCsv, dataDir, overrides = {} }: ImportOptions): ImportReport {
  const { structures, ...planReport } = planStructures(readBp3d(bp3dDir), readWikidata(wikidataCsv), overrides);
  // Structures of the female model come from the HRA import: never reported as orphans here.
  const applied = applyPlan({ dataDir, structures, owns: (s) => s.sex !== 'female' });
  return { ...planReport, ...applied };
}
