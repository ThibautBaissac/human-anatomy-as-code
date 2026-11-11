import { useLayoutEffect } from 'react';
import type { Viewer } from '../viewer/viewer.ts';
import { sheetHeights, viewInsets, type Rect, type SheetHeight } from './layout.ts';

const OVERLAYS = '.header, .drawer, .card, .toolbar, .camera';

/**
 * Tells the viewer how much of the canvas the interface covers, so the scene is centred in what is left free:
 * header, Structures drawer, Infos card and bottom bars on a desktop; header, camera column and bottom sheet on a phone.
 * The sheet counts at its settled height (not mid-transition), and never more than half the window.
 */
export function useViewInsets(viewer: Viewer | null, narrow: boolean, sheet: SheetHeight, layoutKey: string) {
  useLayoutEffect(() => {
    if (!viewer) return;
    const all = (sel: string): Rect[] => [...document.querySelectorAll<HTMLElement>(sel)].map((e) => e.getBoundingClientRect());
    const update = () => {
      const viewport = { width: innerWidth, height: innerHeight };
      if (narrow) {
        const h = Math.min(sheetHeights(innerHeight)[sheet], innerHeight / 2);
        const sheetRect = { left: 0, right: innerWidth, top: innerHeight - h, bottom: innerHeight };
        viewer.setInsets(viewInsets(viewport, { top: all('.header'), right: all('.camera'), bottom: [sheetRect] }, 8));
      } else {
        viewer.setInsets(viewInsets(viewport, { top: all('.header'), left: all('.drawer'), right: all('.card'), bottom: all('.toolbar, .camera') }));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    for (const e of document.querySelectorAll(OVERLAYS)) ro.observe(e);
    addEventListener('resize', update);
    return () => { ro.disconnect(); removeEventListener('resize', update); };
  }, [viewer, narrow, sheet, layoutKey]);
}
