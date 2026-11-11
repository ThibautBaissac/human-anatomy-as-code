import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Viewer } from '../viewer/viewer.ts';
import { PRESETS, type Preset } from '../viewer/camera.ts';
import type { Atlas, Selection } from '../viewer/types.ts';
import { LABEL_OFFSET, labelPlacement } from './layout.ts';
import { S } from './strings.ts';

/** Camera presets and Recentrer; on a phone, Face, Dos, Profil and Recentrer. */
export function CameraGroup({ viewer, narrow }: { viewer: Viewer; narrow: boolean }) {
  const presets: [Preset, string][] = narrow
    ? [['front', S.presets.front], ['back', S.presets.back], ['left', S.profile]]
    : PRESETS.map((p) => [p, S.presets[p]]);
  return (
    <div role="group" aria-label={S.cameraLabel} className="camera surface">
      {presets.map(([p, label]) => <button key={p} type="button" className="btn ghost" onClick={() => viewer.viewFrom(p)}>{label}</button>)}
      <button type="button" className="btn ghost icon" aria-label={S.zoomIn} onClick={() => viewer.zoom(0.8)}><ZoomIn aria-hidden="true" size={18} /></button>
      <button type="button" className="btn ghost icon" aria-label={S.zoomOut} onClick={() => viewer.zoom(1.25)}><ZoomOut aria-hidden="true" size={18} /></button>
      <button type="button" className="btn ghost icon" aria-label={S.recentre} onClick={() => viewer.recentre()}><RotateCcw aria-hidden="true" size={18} /></button>
    </div>
  );
}

const finePointer = () => typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;

/** The name of the structure under the mouse, next to the cursor. Decorative: the selection is what is announced. */
export function HoverLabel({ canvas, hover, nameOf }: { canvas: HTMLCanvasElement | null; hover: Selection | null; nameOf: (s: Selection) => string }) {
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!canvas || !finePointer()) return;
    const move = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY });
    canvas.addEventListener('pointermove', move);
    return () => canvas.removeEventListener('pointermove', move);
  }, [canvas]);
  const text = hover ? nameOf(hover) : '';
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !cursor) return;
    setPos(labelPlacement(cursor, { width: el.offsetWidth, height: el.offsetHeight }, { width: innerWidth, height: innerHeight }));
  }, [cursor, text]);
  if (!hover || !cursor || !text) return null;
  return (
    <div ref={ref} className="hover-label surface" data-testid="hover-label" aria-hidden="true"
      style={{ left: pos?.left ?? cursor.x + LABEL_OFFSET, top: pos?.top ?? cursor.y + LABEL_OFFSET }}>{text}</div>
  );
}

/** Isolation and hidden structures, each with the way back. */
export function Banners({ viewer, isolatedName, hiddenCount, onDone }: { viewer: Viewer; isolatedName: string | null; hiddenCount: number; onDone: () => void }) {
  if (!isolatedName && !hiddenCount) return null;
  return (
    <div className="banners">
      {isolatedName && (
        <div role="status" className="banner surface">
          <span>{S.isolation} : <strong>{isolatedName}</strong></span>
          <button type="button" className="btn small" onClick={() => { viewer.setIsolated(null); onDone(); }}>{S.leaveIsolation}</button>
        </div>
      )}
      {hiddenCount > 0 && (
        <div role="status" className="banner surface">
          <span>{S.hiddenCount(hiddenCount)}</span>
          <button type="button" className="btn small" onClick={() => { viewer.showHidden(); onDone(); }}>{S.showHidden}</button>
        </div>
      )}
    </div>
  );
}

/** Loading progress and errors over the view. */
export function Notifications({ loading, errors, onDone }: { loading: string | null; errors: string[]; onDone: () => void }) {
  const [closed, setClosed] = useState<string[]>([]);
  const shown = errors.filter((e) => !closed.includes(e));
  if (!loading && !shown.length) return null;
  return (
    <div className="notifications">
      {loading && <div role="status" className="toast surface">{loading}</div>}
      {shown.map((e) => (
        <div key={e} role="alert" className="toast surface error">
          <span>{e}</span>
          <button type="button" className="btn ghost icon small" aria-label={S.dismiss} onClick={() => { setClosed((c) => [...c, e]); onDone(); }}><X aria-hidden="true" size={16} /></button>
        </div>
      ))}
    </div>
  );
}

/** Gestures, shortcuts and the rendering backend. */
export function HelpDialog({ open, onClose, backend }: { open: boolean; onClose: () => void; backend: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby="help-title" onClose={onClose}>
      <h2 id="help-title">{S.helpTitle}</h2>
      {S.helpSections.map((sec) => (
        <section key={sec.title}>
          <h3>{sec.title}</h3>
          <ul>{sec.items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
      <p className="muted">{S.backendLabel} : {backend ?? '—'}</p>
      <div className="dialog-actions"><button type="button" className="btn" onClick={onClose}>{S.close}</button></div>
    </dialog>
  );
}

/** One line of credits over the view, and the way to the full licences. */
export function CreditLine({ atlas, onLicences }: { atlas: Atlas | null; onLicences: () => void }) {
  if (!atlas) return null;
  const names = atlas.attributions.map((a) => a.name).join(', ');
  return (
    <p className="credit-line">
      <span className="credit-text" title={names}>{S.credits} : {names}</span>{' · '}
      <button type="button" className="link" onClick={onLicences}>{S.creditsLink}</button>
    </p>
  );
}
