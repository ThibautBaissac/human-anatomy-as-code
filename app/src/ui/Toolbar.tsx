import { useId } from 'react';
import type { Viewer } from '../viewer/viewer.ts';
import { colorOf } from '../viewer/colors.ts';
import { AXES, type ViewState } from '../viewer/types.ts';
import { S } from './strings.ts';

export function Toolbar({ viewer, view, kinds, maxLayer }: { viewer: Viewer; view: ViewState; kinds: string[]; maxLayer: number }) {
  const id = useId();
  return (
    <div className="toolbar">
      <fieldset>
        <legend>{S.kindsLegend}</legend>
        <div className="kinds">
          {kinds.map((k) => (
            <label key={k} className="kind">
              <input type="checkbox" checked={!view.hiddenKinds.includes(k)} onChange={(e) => viewer.setKindVisible(k, e.target.checked)} />
              <span className="swatch" style={{ background: colorOf(k) }} aria-hidden="true" />
              {S.kinds[k] ?? k}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{S.dissection}</legend>
        <label htmlFor={`${id}-layer`}>{S.layerLabel(view.layerCut)}</label>
        <input id={`${id}-layer`} type="range" min={0} max={maxLayer} step={1} value={view.layerCut}
          aria-valuetext={S.layerLabel(view.layerCut)} onChange={(e) => viewer.setLayerCut(Number(e.target.value))} />
        <label className="check">
          <input type="checkbox" checked={view.ghost} onChange={(e) => viewer.setGhost(e.target.checked)} />
          {S.ghost}
        </label>
      </fieldset>
      <fieldset>
        <legend>{S.sections}</legend>
        {AXES.map((a) => {
          const on = view.sections[a] !== undefined;
          return (
            <div key={a} className="section">
              <label className="check">
                <input type="checkbox" checked={on} onChange={(e) => viewer.setSection(a, e.target.checked ? 0.5 : null)} />
                {S.axes[a]}
              </label>
              <input type="range" min={0} max={1} step={0.005} value={view.sections[a] ?? 0.5} disabled={!on}
                aria-label={S.sectionPos(S.axes[a])} aria-valuetext={S.percent(Math.round((view.sections[a] ?? 0.5) * 100))}
                onChange={(e) => viewer.setSection(a, Number(e.target.value))} />
            </div>
          );
        })}
      </fieldset>
    </div>
  );
}
