// Platform detection used by the install guidance. Pure.
export interface PlatformInfo {
  userAgent: string;
  /** navigator.standalone (Safari only): true when launched from the home screen */
  standalone: boolean | undefined;
  maxTouchPoints: number;
}

/** Safari on iPhone/iPad, not launched from the home screen: its data is erased after 7 days without a visit. */
export function isIosNotInstalled(p: PlatformInfo): boolean {
  const iosDevice = /iPhone|iPad|iPod/.test(p.userAgent);
  const ipadAsMac = /Macintosh/.test(p.userAgent) && p.maxTouchPoints > 1;
  return (iosDevice || ipadAsMac) && p.standalone !== true;
}
