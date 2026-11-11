import { useEffect, useLayoutEffect, useState } from 'react';

export type ThemeChoice = 'dark' | 'light' | 'system';
export const THEMES: ThemeChoice[] = ['dark', 'light', 'system'];
const KEY = 'haac.theme';

const read = (): ThemeChoice => {
  try { const v = localStorage.getItem(KEY); if (v === 'dark' || v === 'light' || v === 'system') return v; } catch { /* storage unavailable */ }
  return 'dark';
};
const prefersLight = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;

/**
 * Dark (the default), light, or as the system says. Sets data-theme on the document and the browser bar colour;
 * the 3D canvas is transparent over the --stage colour.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);
  const [systemLight, setSystemLight] = useState(prefersLight);
  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: light)');
    const on = () => setSystemLight(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  const theme = choice === 'system' ? (systemLight ? 'light' : 'dark') : choice;
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    const stage = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim();
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', stage);
  }, [theme]);
  const choose = (c: ThemeChoice) => { setChoice(c); try { localStorage.setItem(KEY, c); } catch { /* storage unavailable */ } };
  return { choice, choose };
}
