import { useEffect, useState } from 'react';
import type { Viewer } from '../viewer/viewer.ts';
import { S } from './strings.ts';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ?bench=1: waits for picking to be ready, orbits 10 s, shows a JSON report to copy (nothing is sent anywhere). */
export function Bench({ viewer }: { viewer: Viewer }) {
  const [report, setReport] = useState<string>(S.benchRunning);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      while (!viewer.pickReadyMs) await wait(100);
      await wait(2000);
      const times = (await viewer.orbitFor(10_000)).sort((a, b) => a - b);
      if (!times.length) { setReport(S.benchRunning); return; } // tab hidden: no frame was drawn
      const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      const out = {
        userAgent: navigator.userAgent,
        backend: viewer.getSnapshot().backend,
        canvas: `${viewer.canvas.width}x${viewer.canvas.height}`,
        devicePixelRatio,
        source: viewer.loadSource,
        firstFrameMs: Math.round(viewer.firstFrameMs),
        pickReadyMs: Math.round(viewer.pickReadyMs),
        meanFrameMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
        p95FrameMs: +times[Math.floor(times.length * 0.95)].toFixed(2),
        fps: +(1000 / (times.reduce((a, b) => a + b, 0) / times.length)).toFixed(1),
        instances: viewer.catalog?.instanceCount,
        usedJSHeapMB: memory ? Math.round(memory.usedJSHeapSize / 1e6) : null,
      };
      if (!cancelled) setReport(JSON.stringify(out, null, 2));
      (window as unknown as { __bench?: unknown }).__bench = out;
    })();
    return () => { cancelled = true; };
  }, [viewer]);
  return (
    <section className="bench" aria-label={S.benchLabel}>
      <pre data-testid="bench">{report}</pre>
      <button type="button" onClick={() => navigator.clipboard?.writeText(report)}>{S.copy}</button>
    </section>
  );
}
