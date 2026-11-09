import { useEffect, useRef, useState } from 'react';
import { DownloadError, NoControllerError, makeAvailableOffline, readStatus } from '../offline/offline.ts';
import type { AssetManifest, OfflineStatus } from '../offline/offline-state.ts';
import type { Atlas } from '../viewer/types.ts';
import { S } from './strings.ts';

const IOS_HINT_KEY = 'haac.iosHintDismissed';
const mb = (b: number) => (b / 1e6).toFixed(1).replace('.', ',');

export function OfflineDialog({ open, onClose, supported, canInstall, install, iosHint, model, atlas }: {
  open: boolean; onClose: () => void; supported: boolean; canInstall: boolean; install: () => void; iosHint: boolean; model: string; atlas: Atlas | null;
}) {
  const hra = atlas?.attributions.find((a) => a.source === 'hra');
  const ref = useRef<HTMLDialogElement>(null);
  const [manifest, setManifest] = useState<AssetManifest | null>(null);
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [hideIos, setHideIos] = useState(() => { try { return localStorage.getItem(IOS_HINT_KEY) === '1'; } catch { return false; } });

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || !supported) return;
    (async () => {
      const m = (await (await fetch('/assets/manifest.json')).json()) as AssetManifest;
      setManifest(m);
      setStatus(await readStatus(m, m.models ? [model] : undefined));
    })().catch(() => setError(S.offlineReadError));
  }, [open, supported, model]);

  const download = async (models: string[]) => {
    if (!manifest || busy.current) return; // one download at a time, even on repeated clicks
    busy.current = true;
    setError(null);
    setProgress([0, manifest.totalBytes]);
    try {
      await makeAvailableOffline(manifest, manifest.models ? models : undefined, (d, t) => setProgress([d, t]));
      setStatus(await readStatus(manifest, manifest.models ? [model] : undefined));
    } catch (e) {
      if (e instanceof DownloadError) setStatus(e.status);
      setError(e instanceof NoControllerError ? S.offlineNoController : S.offlineDownloadError);
    } finally {
      busy.current = false;
      setProgress(null);
    }
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="offline-title" onClose={onClose}>
      <h2 id="offline-title">{S.offlineTitle}</h2>
      {!supported ? <p>{S.offlineUnsupported}</p> : (
        <>
          <p data-testid="offline-state" role="status">
            {!status ? S.offlineChecking
              : status.state === 'complete' ? S.offlineComplete(mb(status.totalBytes))
              : status.state === 'partial' && status.cachedBytes === status.totalBytes ? S.offlineDataMissing
              : status.state === 'partial' ? S.offlinePartial(mb(status.cachedBytes), mb(status.totalBytes))
              : S.offlineNone(mb(status.totalBytes))}
          </p>
          {status && <p>{status.persisted ? S.persisted : S.notPersisted}</p>}
          {progress && (
            <p>
              <label htmlFor="offline-progress">{S.downloading}</label>{' '}
              <progress id="offline-progress" max={progress[1]} value={progress[0]}>{Math.round((100 * progress[0]) / progress[1])} %</progress>
            </p>
          )}
          {error && <p role="alert" className="error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={() => download([model])} disabled={!manifest || !!progress || status?.state === 'complete'}>{manifest?.models ? S.offlineThisModel(model) : S.makeOffline}</button>
            {manifest?.models && <button type="button" onClick={() => download(Object.keys(manifest.models!))} disabled={!manifest || !!progress}>{S.offlineBothModels}</button>}
            {canInstall && <button type="button" onClick={install}>{S.install}</button>}
          </div>
          {iosHint && !hideIos && (
            <div className="ios-hint">
              <p>{S.iosHint}</p>
              <button type="button" className="link" onClick={() => { setHideIos(true); closeButton.current?.focus(); try { localStorage.setItem(IOS_HINT_KEY, '1'); } catch { /* private mode */ } }}>{S.iosHintDismiss}</button>
            </div>
          )}
        </>
      )}
      {hra?.dois && (
        <>
          <h3>{S.hraCredits}</h3>
          <ul className="dois">
            {hra.dois.map((d) => <li key={d.organ}><a href={`https://doi.org/${d.doi}`}>{d.organ}</a> — {d.doi}</li>)}
          </ul>
        </>
      )}
      <div className="dialog-actions"><button ref={closeButton} type="button" onClick={onClose}>{S.close}</button></div>
    </dialog>
  );
}
