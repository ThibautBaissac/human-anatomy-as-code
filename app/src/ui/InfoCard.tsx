import { useRef, useState } from 'react';
import { Crosshair, EyeOff, Focus, Info, Play, Waypoints, X } from 'lucide-react';
import { NETWORK_KINDS, selectionKey, type Catalog, type RelationItem } from '../viewer/catalog.ts';
import { jointKey, jointsFor, lengthTrend, motionDirection, musclesOf, parseJointKey } from '../viewer/pose.ts';
import { labelLang, labelText, structureName, structureNameLang } from '../viewer/search.ts';
import type { Viewer } from '../viewer/viewer.ts';
import { LANGS, ROLES_OF, type Lang, type Selection, type ViewState } from '../viewer/types.ts';
import { S } from './strings.ts';

const TREND_MARK: Record<string, string> = { shortens: '↓', lengthens: '↑', stable: '≈' };
/** Lists longer than this show their first items and a button for the rest. */
const FOLD_AT = 5;

/** Pointer or focus on a structure name in the card tints it in the 3D view, like hovering it there. */
const previewProps = (viewer: Viewer, sel: Selection) => ({
  onPointerEnter: () => viewer.preview(sel), onPointerLeave: () => viewer.preview(null),
  onFocus: () => viewer.preview(sel), onBlur: () => viewer.preview(null),
});

/** A list folded after FOLD_AT items, with « N autres » to unfold it. */
function Folded<T>({ items, render, className, label }: { items: T[]; render: (x: T) => React.ReactNode; className: string; label: string }) {
  const [open, setOpen] = useState(false);
  const shown = open || items.length <= FOLD_AT + 1 ? items : items.slice(0, FOLD_AT);
  return (
    <>
      <ul className={className} aria-label={label}>{shown.map(render)}</ul>
      {items.length > FOLD_AT + 1 && (
        <button type="button" className="btn ghost small more-items" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? S.fewerItems : S.moreItems(items.length - FOLD_AT)}
        </button>
      )}
    </>
  );
}

/**
 * The selected structure: name, side, nature, systems, actions (Centrer, Isoler, Masquer, Animer), names,
 * its part in movements, parts, and the technical details folded.
 */
export function InfoCard({ viewer, catalog, view, motionKey, onSelect, onClose, onHide, onAnimate, animatable }: {
  viewer: Viewer; catalog: Catalog; view: ViewState & { selection: Selection }; motionKey: string | null;
  onSelect: (sel: Selection) => void; onClose: () => void; onHide: () => void; onAnimate: () => void; animatable: boolean;
}) {
  const { selection, lang } = view;
  const s = catalog.structure(selection.slug);
  if (!s) return null;
  const parent = s.parent ? catalog.structure(s.parent) : undefined;
  const isolated = !!view.isolated && selectionKey(view.isolated) === selectionKey(selection);
  const networkable = NETWORK_KINDS.includes(s.kind) && catalog.network(selection).length > 1;
  const networked = !!view.network && selectionKey(view.network) === selectionKey(selection);
  const relations = catalog.relationsOf(selection);
  const draftNames = LANGS.some((l) => s.labels[l]?.status === 'draft');
  const draftRelations = relations.some((i) => i.status === 'draft');
  const subtitle = [selection.side ? S.sideOf(S.side[selection.side]) : null, S.kinds[s.kind] ?? s.kind].filter(Boolean).join(' · ');
  return (
    <>
      <div className="card-head">
        <div className="card-title">
          <h2 id="panel-name" lang={structureNameLang(s, selection.side, lang)}>{structureName(s, selection.side, lang)}</h2>
          <p className="muted small">
            {subtitle}
            {parent && <> · {S.partOf} <button type="button" className="link" lang={labelLang(parent, lang)} onClick={() => onSelect({ slug: parent.slug, side: null })}>{labelText(parent, lang)}</button></>}
          </p>
        </div>
        <button type="button" className="btn ghost icon" aria-label={S.closeSelection} onClick={onClose}><X aria-hidden="true" size={18} /></button>
      </div>
      {s.sides && (
        // a side can also be chosen without the 3D view (keyboard, screen reader)
        <div role="group" aria-label={S.sideChoice} className="segmented sides">
          {([null, 'left', 'right'] as const).filter((x) => x === null || s.sides?.[x]).map((x) => (
            <button key={x ?? 'both'} type="button" className="btn small" aria-pressed={selection.side === x}
              onClick={() => onSelect({ slug: s.slug, side: x })}>{x ? S.sideButton[x] : S.bothSides}</button>
          ))}
        </div>
      )}
      {s.systems && s.systems.length > 0 && (
        <ul className="chips" aria-label={S.systemsLabel}>
          {s.systems.map((x) => <li key={x} className="chip">{S.systems[x] ?? x}</li>)}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="btn action" onClick={() => viewer.focus(selection.slug, selection.side)}><Crosshair aria-hidden="true" size={18} />{S.centre}</button>
        <button type="button" className="btn action" aria-pressed={isolated} onClick={() => viewer.setIsolated(isolated ? null : selection)}><Focus aria-hidden="true" size={18} />{S.isolateStructure}</button>
        <button type="button" className="btn action" onClick={onHide}><EyeOff aria-hidden="true" size={18} />{S.hide}</button>
        {networkable && <button type="button" className="btn action" aria-pressed={networked} onClick={() => viewer.setNetwork(networked ? null : selection)}><Waypoints aria-hidden="true" size={18} />{S.showNetwork}</button>}
        {animatable && <button type="button" className="btn action" onClick={onAnimate}><Play aria-hidden="true" size={18} />{S.animate}</button>}
      </div>
      <dl className="names">
        {LANGS.map((l) => (
          <div key={l}>
            <dt>{S.langs[l]}</dt>
            <dd lang={l}>{s.labels[l]?.text ?? <span className="muted">{S.noName}</span>}</dd>
          </div>
        ))}
      </dl>
      {(draftNames || draftRelations) && <p className="draft-note muted small"><Info aria-hidden="true" size={14} />{S.draftNote(draftNames, draftRelations)}</p>}
      <Relations viewer={viewer} catalog={catalog} items={relations} selection={selection} lang={lang} onSelect={onSelect} />
      <MotionInfo viewer={viewer} catalog={catalog} view={view} motionKey={motionKey} onSelect={onSelect} lang={lang} />
      {s.children.length > 0 && (
        <div className="card-section">
          <h3>{S.children}</h3>
          <Folded key={s.slug} className="children" label={S.children} items={s.children.filter((c) => catalog.structure(c))} render={(c) => {
            const child = catalog.structure(c)!;
            return <li key={c}><button type="button" className="link" lang={labelLang(child, lang)} {...previewProps(viewer, { slug: c, side: null })} onClick={() => onSelect({ slug: c, side: null })}>{labelText(child, lang)}</button></li>;
          }} />
        </div>
      )}
      <details className="details">
        <summary>{S.details}</summary>
        <dl className="facts">
          <div><dt>{S.slug}</dt><dd><code>{s.slug}</code></dd></div>
          {s.layer !== null && <div><dt>{S.layer}</dt><dd>{s.layer}</dd></div>}
          <div><dt>{S.status}</dt><dd>{S.statusValues[s.status] ?? s.status}</dd></div>
        </dl>
      </details>
    </>
  );
}

/** Relations of the selection, one section per type and direction (their draft status is in the card's single note). */
function Relations({ viewer, catalog, items, selection, lang, onSelect }: { viewer: Viewer; catalog: Catalog; items: RelationItem[]; selection: Selection; lang: Lang; onSelect: (sel: Selection) => void }) {
  if (!items.length) return null;
  const groups = new Map<string, RelationItem[]>();
  for (const i of items) groups.set(`${i.direction}:${i.type}`, [...(groups.get(`${i.direction}:${i.type}`) ?? []), i]);
  return (
    <>
      {[...groups.entries()].map(([k, list]) => {
        const title = S.relationTitles[list[0].direction][list[0].type];
        return (
          <div className="card-section" key={k}>
            <h3>{title}</h3>
            <Folded key={`${selectionKey(selection)}-${k}`} className="relations" label={title} items={list} render={(i) => {
              const target = catalog.structure(i.ref);
              const labels = catalog.labelsOf(i.ref) ?? {};
              const name = labelText({ slug: i.ref, labels }, lang);
              const mark = i.mark ? ` — ${S.sideButton[i.mark]}` : '';
              return (
                <li key={`${i.ref}-${i.side ?? ''}-${i.mark ?? ''}`}>
                  {i.presence === 'present' && target ? (
                    <><button type="button" className="link" lang={labelLang({ labels }, lang)} {...previewProps(viewer, { slug: i.ref, side: i.side })} onClick={() => onSelect({ slug: i.ref, side: i.side })}>{name}</button>{mark}</>
                  ) : (
                    <span lang={labelLang({ labels }, lang)}>{name}<span className="muted"> ({i.presence === 'external' ? S.noModel : S.outsideModel})</span>{mark}</span>
                  )}
                </li>
              );
            }} />
          </div>
        );
      })}
    </>
  );
}

/** The structure's part in movements: a muscle's roles; for a bone, the muscles acting on its current joint and how their length changes. */
function MotionInfo({ viewer, catalog, view, motionKey, onSelect, lang }: {
  viewer: Viewer; catalog: Catalog; view: ViewState & { selection: Selection }; motionKey: string | null; onSelect: (sel: Selection) => void; lang: Lang;
}) {
  const last = useRef<{ key: string; angle: number; direction: 1 | -1 } | null>(null);
  const s = catalog.structure(view.selection.slug)!;
  const joints = jointsFor(viewer.joints, s);
  if (!joints.length) return null;
  if (s.actions?.length) {
    return (
      <div className="card-section">
        <h3>{S.actsOn}</h3>
        <ul className="roles">
          {s.actions.map((a) => {
            const j = viewer.joints.find((x) => x.slug === a.joint);
            return <li key={`${a.joint}-${a.role}`}><span>{j ? labelText(j, lang) : a.joint}</span><span className="chip role">{S.roles[a.role]}</span></li>;
          })}
        </ul>
      </div>
    );
  }
  const chosen = motionKey ? parseJointKey(motionKey) : null;
  const joint = joints.find((j) => j.slug === chosen?.slug) ?? joints[0];
  const side = (chosen?.slug === joint.slug ? chosen.side : null) ?? view.selection.side ?? 'left';
  const key = jointKey(joint.slug, side as 'left' | 'right');
  const rig = viewer.rigs[key];
  const muscles = musclesOf(joint, viewer.atlas?.structures ?? [], rig, lang);
  if (!muscles.length) return null;
  const angle = view.pose[key] ?? Math.round(joint.restDeg);
  const playing = viewer.getSnapshot().playing;
  const previous = last.current?.key === key ? last.current : null;
  const direction: 1 | -1 = playing?.keys.includes(key) ? playing.direction : motionDirection(previous, angle, joint.restDeg);
  last.current = { key, angle, direction };
  const [positive, negative] = ROLES_OF[joint.motion];
  return (
    <div className="card-section">
      <h3>{S.musclesHeading(S.movingTowards[direction > 0 ? positive : negative])} — {labelText(joint, lang)}</h3>
      <Folded key={`${s.slug}-${key}`} className="muscles" label={S.musclesHeading(S.movingTowards[direction > 0 ? positive : negative])} items={muscles} render={({ structure: m, role, rig: r }) => {
          const trend = r ? lengthTrend(r, direction, joint.motion) : null;
          return (
            <li key={`${m.slug}-${role}`}>
              <button type="button" className="link" lang={labelLang(m, lang)} {...previewProps(viewer, { slug: m.slug, side: view.selection.side })} onClick={() => onSelect({ slug: m.slug, side: view.selection.side })}>{labelText(m, lang)}</button>
              {' '}<span className="muted">({S.roles[role]})</span>{' '}
              <span className={`trend trend-${trend ?? 'unknown'}`}>{trend && <span aria-hidden="true">{TREND_MARK[trend]} </span>}{trend ? S.trends[trend] : S.trendUnknown}</span>
            </li>
          );
        }} />
    </div>
  );
}
