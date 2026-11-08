import { useRef, type ReactNode } from 'react';
import { tabsKeyReducer } from './tabs-model.ts';
import { S } from './strings.ts';

/** ARIA APG Tabs, automatic activation. */
export function Tabs({ current, onChange, panels }: { current: string; onChange: (id: string) => void; panels: Record<string, ReactNode> }) {
  const ids = Object.keys(panels);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = tabsKeyReducer(ids, current, e.key);
    if (next === current) return;
    e.preventDefault();
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="tabs">
      <div role="tablist" aria-label={S.tabsLabel} className="tablist" onKeyDown={onKeyDown}>
        {ids.map((id) => (
          <button key={id} ref={(el) => { refs.current[id] = el; }} type="button" role="tab" id={`tab-${id}`}
            aria-selected={id === current} aria-controls={`panel-${id}`} tabIndex={id === current ? 0 : -1}
            onClick={() => onChange(id)}>
            {S.tabs[id]}
          </button>
        ))}
      </div>
      {ids.map((id) => (
        <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={id !== current} className="tabpanel">
          {panels[id]}
        </div>
      ))}
    </div>
  );
}
