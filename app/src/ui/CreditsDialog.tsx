import { useEffect, useRef } from 'react';
import type { Atlas } from '../viewer/types.ts';
import { S } from './strings.ts';

/** Every source the displayed model uses: name, credit, licence, link, and the licence notice when one must be reproduced. */
export function CreditsDialog({ open, onClose, atlas }: { open: boolean; onClose: () => void; atlas: Atlas | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog credits-dialog" aria-labelledby="credits-title" onClose={onClose}>
      <h2 id="credits-title">{S.creditsTitle}</h2>
      <ul className="credits-list">
        {atlas?.attributions.map((a) => (
          <li key={a.source}>
            <h3>{a.name}</h3>
            <p>{a.attribution}</p>
            <p>{S.licence} : {a.licence} · <a href={a.url}>{a.url}</a></p>
            {a.notice && <pre className="notice" tabIndex={0}>{a.notice}</pre>}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose}>{S.close}</button>
    </dialog>
  );
}
