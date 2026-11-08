import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Code-point string order, used everywhere a deterministic sort is needed. */
export const byKey = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** All .yaml files under a directory, recursively, sorted; empty when the directory is missing. */
export function listYaml(dir: string): string[] {
  let out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listYaml(p));
    else if (e.name.endsWith('.yaml')) out.push(p);
  }
  return out.sort(byKey);
}
