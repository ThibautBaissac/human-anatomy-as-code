import { useEffect, useState } from 'react';
import type { Viewer } from '../viewer/viewer.ts';
import type { Quality } from '../viewer/rendering.ts';

export const QUALITIES: Quality[] = ['high', 'low'];
const KEY = 'haac.quality';
const read = (): Quality | null => {
  try { const v = localStorage.getItem(KEY); if (v === 'high' || v === 'low') return v; } catch { /* storage unavailable */ }
  return null;
};

/** Rendering quality: detailed (ambient occlusion) by default, light on a phone; the choice is kept in the browser. */
export function useQuality(viewer: Viewer | null, narrow: boolean) {
  const [chosen, setChosen] = useState<Quality | null>(read);
  const quality: Quality = chosen ?? (narrow || matchMedia('(pointer: coarse)').matches ? 'low' : 'high');
  useEffect(() => { viewer?.setQuality(quality); }, [viewer, quality]);
  const choose = (q: Quality) => { setChosen(q); try { localStorage.setItem(KEY, q); } catch { /* storage unavailable */ } };
  return { quality, choose };
}
