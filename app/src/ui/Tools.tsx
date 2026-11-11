import { forwardRef, useId } from 'react';
import { Activity, Layers, Pause, Play, Scissors, SquareSplitVertical } from 'lucide-react';
import { prefersReducedMotion, type Viewer } from '../viewer/viewer.ts';
import { colorOf } from '../viewer/colors.ts';
import { jointKey, parseJointKey } from '../viewer/pose.ts';
import { labelText } from '../viewer/search.ts';
import { AXES, DEFAULT_HIDDEN_SYSTEMS, sameSystems, type AtlasJoint, type Side, type ViewState } from '../viewer/types.ts';
import { S } from './strings.ts';

const SIDES: Side[] = ['left', 'right'];
export type Tool = 'layers' | 'dissection' | 'sections' | 'motion';
export const TOOLS: Tool[] = ['layers', 'dissection', 'sections', 'motion'];
const ICONS = { layers: Layers, dissection: Scissors, sections: SquareSplitVertical, motion: Activity };

/** Whether a tool's part of the view differs from the default (the mark on its button). */
export function toolModified(tool: Tool, v: ViewState): boolean {
  if (tool === 'layers') return !sameSystems(v.hiddenSystems, DEFAULT_HIDDEN_SYSTEMS) || v.hiddenKinds.length > 0;
  if (tool === 'dissection') return v.layerCut > 0 || v.ghost;
  if (tool === 'sections') return Object.keys(v.sections).length > 0;
  return Object.keys(v.pose).length > 0;
}

/** One tool button: icon, visible label, a mark when modified. */
export const ToolButton = forwardRef<HTMLButtonElement, { tool: Tool; open: boolean; modified: boolean; onClick: () => void; controls: string }>(
  function ToolButton({ tool, open, modified, onClick, controls }, ref) {
    const Icon = ICONS[tool];
    return (
      <button ref={ref} type="button" className="tool" aria-pressed={open} aria-controls={controls} onClick={onClick}
        aria-label={modified ? S.modified(S.toolNames[tool]) : undefined}>
        <span className="tool-icon"><Icon aria-hidden="true" size={22} />{modified && <span className="mark" aria-hidden="true" />}</span>
        {S.toolNames[tool]}
      </button>
    );
  });

export function LayersPanel({ viewer, view, kinds, systems }: { viewer: Viewer; view: ViewState; kinds: string[]; systems: string[] }) {
  return (
    <>
      <div className="panel-head">
        <h3>{S.systemsLabel}</h3>
        <button type="button" className="btn ghost small" onClick={() => viewer.showAllSystems()} disabled={view.hiddenSystems.length === 0}>{S.showAllSystems}</button>
      </div>
      <ul className="systems">
        {systems.map((x) => {
          const name = S.systems[x] ?? x;
          return (
            <li key={x}>
              <label className="switch-row">
                <input type="checkbox" className="switch" checked={!view.hiddenSystems.includes(x)} onChange={(e) => viewer.setSystemVisible(x, e.target.checked)} />
                <span>{name}</span>
              </label>
              <button type="button" className="btn ghost small" aria-label={S.soloSystem(name)} onClick={() => viewer.soloSystem(x)}>{S.solo}</button>
            </li>
          );
        })}
      </ul>
      <details className="kinds-fold">
        <summary>{S.byKind}</summary>
        <div className="kinds">
          {kinds.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={!view.hiddenKinds.includes(k)} onChange={(e) => viewer.setKindVisible(k, e.target.checked)} />
              <span className="swatch" style={{ background: colorOf(k) }} aria-hidden="true" />
              {S.kinds[k] ?? k}
            </label>
          ))}
        </div>
      </details>
    </>
  );
}

export function DissectionPanel({ viewer, view, maxLayer }: { viewer: Viewer; view: ViewState; maxLayer: number }) {
  const id = useId();
  return (
    <>
      <label htmlFor={`${id}-layer`} className="field-label">{S.layerLabel(view.layerCut)}</label>
      <input id={`${id}-layer`} type="range" min={0} max={maxLayer} step={1} value={view.layerCut}
        aria-valuetext={S.layerLabel(view.layerCut)} onChange={(e) => viewer.setLayerCut(Number(e.target.value))} />
      <label className="switch-row">
        <input type="checkbox" className="switch" checked={view.ghost} onChange={(e) => viewer.setGhost(e.target.checked)} />
        <span>{S.ghost}</span>
      </label>
    </>
  );
}

export function SectionsPanel({ viewer, view }: { viewer: Viewer; view: ViewState }) {
  return (
    <>
      {AXES.map((a) => {
        const on = view.sections[a] !== undefined;
        return (
          <div key={a} className="section-row">
            <label className="switch-row">
              <input type="checkbox" className="switch" checked={on} onChange={(e) => viewer.setSection(a, e.target.checked ? 0.5 : null)} />
              <span className={on ? undefined : 'muted'}>{S.axes[a]}</span>
            </label>
            <input type="range" min={0} max={1} step={0.005} value={view.sections[a] ?? 0.5} disabled={!on}
              aria-label={S.sectionPos(S.axes[a])} aria-valuetext={S.percent(Math.round((view.sections[a] ?? 0.5) * 100))}
              onChange={(e) => viewer.setSection(a, Number(e.target.value))} />
          </div>
        );
      })}
    </>
  );
}

/** Every animatable joint-side of the model, as joint@side keys. */
export function jointOptions(viewer: Viewer): string[] {
  return viewer.joints.flatMap((j) => SIDES.filter((side) => viewer.rigs[jointKey(j.slug, side)]).map((side) => jointKey(j.slug, side)));
}

/** Plays one joint-side now (looping; one sweep under reduced motion). */
export function playJoint(viewer: Viewer, key: string) {
  const { slug, side } = parseJointKey(key);
  viewer.play(slug, [side as Side], { once: prefersReducedMotion() });
}

export function MotionTool({ viewer, view, motionKey, onChoose }: { viewer: Viewer; view: ViewState; motionKey: string | null; onChoose: (key: string) => void }) {
  const id = useId();
  const options = jointOptions(viewer);
  const key = motionKey && options.includes(motionKey) ? motionKey : options[0];
  if (!key) return <p className="muted">{S.noJoint}</p>;
  const { slug, side } = parseJointKey(key);
  const joint = viewer.joints.find((j) => j.slug === slug) as AtlasJoint;
  const sides = [side as Side];
  const angle = view.pose[key] ?? Math.round(joint.restDeg);
  const playing = viewer.getSnapshot().playing;
  const isPlaying = !!playing?.keys.includes(key);
  const [lo, hi] = joint.rangeDeg;
  const arc = joint.functionalArcDeg;
  const pct = (deg: number) => `${((deg - lo) / (hi - lo)) * 100}%`;
  const nameOf = (k: string) => {
    const p = parseJointKey(k), j = viewer.joints.find((x) => x.slug === p.slug)!;
    return S.jointOption(labelText(j, view.lang), S.side[p.side!]);
  };
  return (
    <>
      <div className="motion-row">
        <label className="field-label stacked">{S.jointLabel}
          <select className="field" value={key} onChange={(e) => { viewer.stop(); onChoose(e.target.value); }}>
            {options.map((k) => <option key={k} value={k}>{nameOf(k)}</option>)}
          </select>
        </label>
        <button type="button" className="btn primary icon" aria-pressed={isPlaying} aria-label={S.play}
          onClick={() => (isPlaying ? viewer.stop() : playJoint(viewer, key))}>
          {isPlaying ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
        </button>
        <button type="button" className="btn" aria-label={S.rest} onClick={() => { viewer.stop(); viewer.setJointAngle(joint.slug, sides, joint.restDeg); }}>{S.restShort}</button>
        <div className="angle">
          {arc && <span className="arc" aria-hidden="true" style={{ left: pct(arc[0]), width: `calc(${pct(arc[1])} - ${pct(arc[0])})` }} />}
          <input id={`${id}-angle`} type="range" min={lo} max={hi} step={1} value={angle} aria-label={S.angleLabel(joint.motion)}
            aria-valuetext={S.angleText(joint.motion, angle)} aria-describedby={arc ? `${id}-arc` : undefined}
            onChange={(e) => { viewer.stop(); viewer.setJointAngle(joint.slug, sides, Number(e.target.value)); }}
            onKeyDown={(e) => {
              // Page Up / Page Down: 10° (browsers step by 10 % of the range, 14.5° at the elbow)
              if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
              e.preventDefault();
              viewer.stop();
              viewer.setJointAngle(joint.slug, sides, angle + (e.key === 'PageUp' ? 10 : -10));
            }} />
        </div>
        {/* silent while playing: the value changes every frame */}
        <output htmlFor={`${id}-angle`} className="angle-value" aria-live={isPlaying ? 'off' : 'polite'}>{S.angleText(joint.motion, angle)}</output>
      </div>
      {arc && <p id={`${id}-arc`} className="muted small">{S.functionalArc(arc[0], arc[1])} · {S.ghostedNote}</p>}
    </>
  );
}
