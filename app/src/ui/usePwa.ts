import { useCallback, useEffect, useRef, useState } from 'react';
import { Serwist } from '@serwist/window';
import { isIosNotInstalled } from '../offline/platform.ts';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void> }

/** Service worker registration, update prompt, install prompt, online state. */
export function usePwa() {
  const supported = import.meta.env.PROD && 'serviceWorker' in navigator && 'caches' in window;
  const sw = useRef<Serwist | null>(null);
  const accepted = useRef(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!supported) return;
    const s = new Serwist('/sw.js', { scope: '/', type: 'classic' });
    s.addEventListener('waiting', () => setUpdateReady(true));
    // Reload once the update the user accepted takes control of the page.
    const onControllerChange = () => { if (accepted.current) location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void s.register();
    sw.current = s;
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
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

  const applyUpdate = useCallback(() => { accepted.current = true; sw.current?.messageSkipWaiting(); }, []);
  const dismissUpdate = useCallback(() => setUpdateReady(false), []);
  const install = useCallback(async () => { await installEvent?.prompt(); setInstallEvent(null); }, [installEvent]);
  const iosHint = isIosNotInstalled({
    userAgent: navigator.userAgent,
    standalone: (navigator as unknown as { standalone?: boolean }).standalone,
    maxTouchPoints: navigator.maxTouchPoints,
  });

  return { supported, updateReady, applyUpdate, dismissUpdate, canInstall: !!installEvent, install, online, iosHint };
}
