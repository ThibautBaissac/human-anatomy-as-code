import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { S } from './strings.ts';

export type MenuEntry =
  | { kind: 'item'; label: string; onSelect: () => void }
  | { kind: 'radio'; group: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void };

/**
 * ARIA APG menu button: arrows move, Échap closes and gives focus back, a click outside closes.
 * By default the ⋯ button; `label`, `icon` and `text` make another one, `up` opens the menu above it.
 */
export function MoreMenu({ entries, label = S.more, icon, text, up = false }: { entries: MenuEntry[]; label?: string; icon?: ReactNode; text?: string; up?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? [])];

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const close = (focus = true) => { setOpen(false); if (focus) button.current?.focus(); };
  const choose = (f: () => void) => { close(); f(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = items(), i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === 'Tab') close(false);
  };

  return (
    <div className="menu-wrap">
      <button ref={button} type="button" className={`btn ghost${text ? '' : ' icon'}`} aria-label={text ? undefined : label} aria-haspopup="menu" aria-expanded={open} aria-controls={`${id}-menu`}
        onClick={() => setOpen((o) => !o)}>
        {icon ?? <MoreHorizontal aria-hidden="true" size={20} />}{text}
      </button>
      {open && (
        <div ref={menu} id={`${id}-menu`} role="menu" aria-label={label} className={`menu surface${up ? ' up' : ''}`} onKeyDown={onKeyDown}>
          {entries.map((e, n) => e.kind === 'item' ? (
            <button key={n} type="button" role="menuitem" tabIndex={-1} className="menu-item" onClick={() => choose(e.onSelect)}>{e.label}</button>
          ) : (
            <div key={n} role="group" aria-label={e.group} className="menu-group">
              <div className="menu-group-label" aria-hidden="true">{e.group}</div>
              {e.options.map((o) => (
                <button key={o.value} type="button" role="menuitemradio" tabIndex={-1} aria-checked={o.value === e.value} className="menu-item"
                  onClick={() => choose(() => e.onChange(o.value))}>{o.label}</button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
