import { S } from './strings.ts';

/** The live region stays mounted so screen readers announce the banner when it appears. */
export function UpdateBanner({ visible, onReload, onLater }: { visible: boolean; onReload: () => void; onLater: () => void }) {
  return (
    <div role="status" className={visible ? 'update-banner' : 'visually-hidden'}>
      {visible && (
        <>
          <span>{S.updateReady}</span>
          <button type="button" onClick={onReload}>{S.reload}</button>
          <button type="button" onClick={onLater}>{S.later}</button>
        </>
      )}
    </div>
  );
}
