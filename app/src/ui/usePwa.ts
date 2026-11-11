import { useCallback, useEffect, useRef, useState } from 'react';
import { Serwist } from '@serwist/window';
import { isIosNotInstalled } from '../offline/platform.ts';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void> }

/** Service worker registration, update prompt, install prompt, online state. */
export function usePwa() {
  const supported = import.meta.env.PROD && 'serviceWorker' in navigator && 'caches' in window;
  const sw = useRef<Serwist | null>(null);
  const accepted = useRef(false);
  /** an update another tab accepted already controls this page: only a reload is left to do */
  const activated = useRef(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!supported) return;
    const s = new Serwist('/sw.js', { scope: '/', type: 'classic' });
    s.addEventListener('waiting', () => setUpdateReady(true));
    // Reload once the update the user accepted takes control of the page. An update accepted in another tab
    // also takes control here (clientsClaim): keep the banner, its button now reloads. The first install is not an update.
    let hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (accepted.current) location.reload();
      else if (hadController) { activated.current = true; setUpdateReady(true); }
      hadController = true;
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    s.register().catch((e) => console.error('[sw] registration failed', e));
    sw.current = s;
    // An installed app can stay open for days: look for an update each time it comes back to the foreground.
    const onVisible = () => { if (document.visibilityState === 'visible') s.update().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supported]);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as BeforeInstallPromptEvent); };
    const onInstalled = () => setInstallEvent(null);
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('beforeinstallprompt', onPrompt);
    addEventListener('appinstalled', onInstalled);
    addEventListener('online', on);
    addEventListener('offline', off);
    return () => {
      removeEventListener('beforeinstallprompt', onPrompt);
      removeEventListener('appinstalled', onInstalled);
      removeEventListener('online', on);
      removeEventListener('offline', off);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (activated.current) { location.reload(); return; }
    accepted.current = true;
    sw.current?.messageSkipWaiting();
  }, []);
  const dismissUpdate = useCallback(() => setUpdateReady(false), []);
  const install = useCallback(async () => { await installEvent?.prompt(); setInstallEvent(null); }, [installEvent]);
  const iosHint = isIosNotInstalled({
    userAgent: navigator.userAgent,
    standalone: (navigator as unknown as { standalone?: boolean }).standalone,
    maxTouchPoints: navigator.maxTouchPoints,
  });

  return { supported, updateReady, applyUpdate, dismissUpdate, canInstall: !!installEvent, install, online, iosHint };
}
