import { useRef, useState } from 'react';
import type { Atlas } from '../viewer/types.ts';
import { S } from './strings.ts';

const KEY = 'haac.femaleNoticeHidden';

/** Honest description of the composite female model, dismissible, with a dialog for details and HRA credits. */
export function FemaleNotice({ atlas, onDone }: { atlas: Atlas | null; onDone: () => void }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const dialog = useRef<HTMLDialogElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const hra = atlas?.attributions.find((a) => a.source === 'hra');
  return (
    <>
      {!hidden && (
        <div className="female-notice" role="note">
          <p>{S.femaleNotice}</p>
          <button ref={more} type="button" className="link" onClick={() => dialog.current?.showModal()}>{S.femaleNoticeMore}</button>
          <button type="button" onClick={() => { setHidden(true); try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ } onDone(); }}>{S.femaleNoticeClose}</button>
        </div>
      )}
      <dialog ref={dialog} className="dialog" aria-labelledby="female-about-title" onClose={() => more.current?.focus()}>
        <h2 id="female-about-title">{S.femaleAboutTitle}</h2>
        {S.femaleAbout.map((p, i) => <p key={i}>{p}</p>)}
        {hra?.dois && (
          <>
            <h3>{S.hraCredits}</h3>
            <ul className="dois">
              {hra.dois.map((d) => <li key={d.organ}><a href={`https://doi.org/${d.doi}`}>{d.organ}</a> — {d.doi}</li>)}
            </ul>
          </>
        )}
        <div className="dialog-actions"><button type="button" onClick={() => dialog.current?.close()}>{S.close}</button></div>
      </dialog>
    </>
  );
}
