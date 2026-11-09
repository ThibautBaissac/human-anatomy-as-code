import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Viewer } from '../viewer/viewer.ts';
import type { Catalog } from '../viewer/catalog.ts';
import { jointKey, jointsFor, lengthTrend, motionDirection, musclesOf } from '../viewer/pose.ts';
import { labelText } from '../viewer/search.ts';
import { ROLES_OF, type AtlasJoint, type Selection, type Side, type ViewState } from '../viewer/types.ts';
import { S } from './strings.ts';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const TREND_MARK: Record<string, string> = { shortens: '↓', lengthens: '↑', stable: '≈' };

/** "Mouvement" section of the Info panel: the joints the selection takes part in, an angle slider, play, rest, muscles. */
export function MotionPanel({ viewer, catalog, view, onSelect }:
  { viewer: Viewer; catalog: Catalog; view: ViewState & { selection: Selection }; onSelect: (sel: Selection) => void }) {
  const { selection, lang } = view;
  const id = useId();
  const s = catalog.structure(selection.slug);
  const offered: AtlasJoint[] = s
    ? jointsFor(viewer.joints, s).filter((j) => (['left', 'right'] as Side[]).some((side) => viewer.rigs[jointKey(j.slug, side)]))
    : [];
  const [chosen, setChosen] = useState<string | null>(null);
  /** last angle seen and the way it moved, per joint@side: the trend follows a drag back towards rest */
  const last = useRef<{ key: string; angle: number; direction: 1 | -1 } | null>(null);
  const joint = offered.find((j) => j.slug === chosen) ?? offered[0];
  const sides = (selection.side ? [selection.side] : (['left', 'right'] as Side[])).filter((side) => joint && viewer.rigs[jointKey(joint.slug, side)]);
  const sidesKey = sides.join(',');
  // a joint no longer offered stops playing
  useEffect(() => () => { if (joint) viewer.stop(); }, [viewer, joint?.slug, sidesKey]);
  const rig = joint && sides.length ? viewer.rigs[jointKey(joint.slug, sides[0])] : undefined;
  // computed once per joint, side and language, not on every frame of a playback
  const muscles = useMemo(() => (joint ? musclesOf(joint, viewer.atlas?.structures ?? [], rig, lang) : []), [joint, rig, lang, viewer.atlas]);
  if (!joint || !sides.length) return null;

  const key = jointKey(joint.slug, sides[0]);
  const angle = view.pose[key] ?? Math.round(joint.restDeg);
  const playing = viewer.getSnapshot().playing;
  const isPlaying = playing?.joint === joint.slug;
  const [lo, hi] = joint.rangeDeg;
  const [positive, negative] = ROLES_OF[joint.motion];
  const previous = last.current?.key === key ? last.current : null;
  const direction: 1 | -1 = isPlaying ? playing!.direction : motionDirection(previous, angle, joint.restDeg);
  last.current = { key, angle, direction };
  const name = (j: AtlasJoint) => labelText(j, lang);
  const arc = joint.functionalArcDeg;
  const pct = (deg: number) => `${((deg - lo) / (hi - lo)) * 100}%`;

  return (
    <section className="motion" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{S.motion}</h3>
      {offered.length > 1 && (
        <fieldset className="joint-choice">
          <legend>{S.jointChoice}</legend>
          {offered.map((j) => (
            <label key={j.slug} className="check">
              <input type="radio" name={`${id}-joint`} checked={j.slug === joint.slug} onChange={() => { viewer.stop(); setChosen(j.slug); }} />
              {name(j)}
            </label>
          ))}
        </fieldset>
      )}
      {offered.length === 1 && <p className="joint-name">{name(joint)}</p>}
      <p className="muted">{S.animatedSides(sides)}</p>
      <label htmlFor={`${id}-angle`}>{S.angleLabel(joint.motion)} : <strong>{S.angleText(joint.motion, angle)}</strong></label>
      <div className="angle">
        {arc && <span className="arc" aria-hidden="true" style={{ left: pct(arc[0]), width: `calc(${pct(arc[1])} - ${pct(arc[0])})` }} />}
        <input id={`${id}-angle`} type="range" min={lo} max={hi} step={1} value={angle}
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
      {arc && <p id={`${id}-arc`} className="muted">{S.functionalArc(arc[0], arc[1])}</p>}
      <div className="motion-buttons">
        <button type="button" aria-pressed={isPlaying}
          onClick={() => (isPlaying ? viewer.stop() : viewer.play(joint.slug, sides, { once: reducedMotion() }))}>
          <span aria-hidden="true">{isPlaying ? '❚❚ ' : '▶ '}</span>{S.play}
        </button>
        <button type="button" onClick={() => { viewer.stop(); viewer.setJointAngle(joint.slug, sides, joint.restDeg); }}>{S.rest}</button>
      </div>
      <p className="muted">{S.ghostedNote}</p>
      {muscles.length > 0 && (
        <>
          <h4>{S.musclesHeading(S.movingTowards[direction > 0 ? positive : negative])}</h4>
          <ul className="muscles">
            {muscles.map(({ structure: m, role, rig: r }) => {
              const trend = r ? lengthTrend(r, direction, joint.motion) : null;
              return (
                <li key={m.slug}>
                  <button type="button" className="link" onClick={() => onSelect({ slug: m.slug, side: selection.side })}>{labelText(m, lang)}</button>
                  {' '}<span className="role">({S.roles[role]})</span>{' '}
                  <span className={`trend trend-${trend ?? 'unknown'}`}>
                    {trend && <span aria-hidden="true">{TREND_MARK[trend]} </span>}{trend ? S.trends[trend] : S.trendUnknown}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
