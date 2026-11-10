import { useRef, useState, type ReactNode } from 'react';
import { nextSheet, sheetHeights, snapSheet, type SheetHeight } from './layout.ts';
import { S } from './strings.ts';

/** Phone bottom sheet: three heights; the handle cycles them on tap, follows a drag and snaps on release. */
export function Sheet({ height, onHeight, header, children }: { height: SheetHeight; onHeight: (h: SheetHeight) => void; header: ReactNode; children: ReactNode }) {
  const [drag, setDrag] = useState<number | null>(null);
  /** the drag in progress; its live height is kept here, a pointerup can come before React re-renders */
  const start = useRef<{ y: number; h: number; moved: boolean; live: number } | null>(null);
  /** a drag ends with a click event: that click must not also cycle the height */
  const dragged = useRef(false);
  const heights = sheetHeights(innerHeight);
  const px = drag ?? heights[height];
  return (
    <section className={`sheet surface${drag !== null ? ' is-dragging' : ''}`} aria-label={S.sheetLabel} style={{ height: px }} data-height={height}>
      <button type="button" className="sheet-handle" aria-label={S.sheetNext[height]}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { y: e.clientY, h: px, moved: false, live: px }; }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dy = s.y - e.clientY;
          if (Math.abs(dy) > 6) s.moved = true;
          if (s.moved) { s.live = Math.min(Math.max(s.h + dy, heights.folded), heights.full); setDrag(s.live); }
        }}
        onPointerUp={() => {
          const s = start.current;
          start.current = null;
          setDrag(null);
          if (s?.moved) { dragged.current = true; onHeight(snapSheet(s.live, heights)); }
        }}
        onPointerCancel={() => { start.current = null; setDrag(null); }}
        onLostPointerCapture={() => { if (start.current) { start.current = null; setDrag(null); } }}
        onClick={() => { if (dragged.current) { dragged.current = false; return; } onHeight(nextSheet(height)); }}>
        <span aria-hidden="true" />
      </button>
      {height === 'folded' && <div className="sheet-header">{header}</div>}
      {height !== 'folded' && <div className="sheet-body">{children}</div>}
    </section>
  );
}
