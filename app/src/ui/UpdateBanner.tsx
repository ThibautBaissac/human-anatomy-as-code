import { S } from './strings.ts';

export function UpdateBanner({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  return (
    <div className="update-banner" role="status">
      <span>{S.updateReady}</span>
      <button type="button" onClick={onReload}>{S.reload}</button>
      <button type="button" onClick={onLater}>{S.later}</button>
    </div>
  );
}
