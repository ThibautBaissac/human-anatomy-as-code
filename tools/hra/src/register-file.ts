// Reads data/import/hra-registration.yaml, fits every region, writes the results back (comments kept).
import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { computeRegions, type RegionConfig } from './register.ts';

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

export function registerFile(path: string): { ok: boolean; summary: string[] } {
  const doc = parseDocument(readFileSync(path, 'utf8'));
  const conf = doc.toJS() as { maxRmsMm?: number; regions: Record<string, RegionConfig> };
  const max = conf.maxRmsMm ?? 25;
  const results = computeRegions(conf.regions, max);
  const summary: string[] = [];
  for (const [name, r] of Object.entries(results)) {
    doc.setIn(['regions', name, 'result'], doc.createNode({
      scale: round(r.scale, 5), rotationDeg: round(r.rotationDeg, 2), rmsMm: round(r.rmsMm, 1), maxMm: round(r.maxMm, 1),
      matrix: r.matrix.map((v) => round(v, 6)),
    }, { flow: false }));
    const c = conf.regions[name];
    summary.push(c.fit === 'offset'
      ? `${name.padEnd(10)} région ${c.from} + décalage [${(c.adjust ?? [0, 0, 0]).join(', ')}] mm (pas de repères propres)`
      : `${name.padEnd(10)} échelle ${r.scale.toFixed(3)} · rotation ${r.rotationDeg.toFixed(1)}° · écart RMS ${r.rmsMm.toFixed(1)} mm (max ${r.maxMm.toFixed(1)})${r.ok ? '' : `  ✗ au-delà de ${max} mm`}`);
  }
  // keep each matrix on one line for readability
  doc.toString();
  for (const name of Object.keys(results)) {
    const m = doc.getIn(['regions', name, 'result', 'matrix'], true) as { flow?: boolean } | undefined;
    if (m) m.flow = true;
  }
  writeFileSync(path, doc.toString({ lineWidth: 0 }));
  return { ok: Object.values(results).every((r) => r.ok), summary };
}
