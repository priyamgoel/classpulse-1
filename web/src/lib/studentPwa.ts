export const INSTALL_BANNER_DISMISSED_KEY =
  'classpulse_student_install_banner_dismissed';

/** iOS, including iPadOS which reports itself as MacIntel with touch. */
export function isIosDevice(
  userAgent: string,
  platform = '',
  maxTouchPoints = 0
): boolean {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  );
}

/** Safari proper, not Chrome/Firefox/Edge or an in-app WebKit browser. */
export function isIosSafari(
  userAgent: string,
  platform = '',
  maxTouchPoints = 0
): boolean {
  if (!isIosDevice(userAgent, platform, maxTouchPoints)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(userAgent)) return false;
  return /Safari\//.test(userAgent) && !isInAppBrowser(userAgent);
}

/**
 * WebViews inside social/messaging apps. Add to Home Screen is unreliable or
 * unavailable there, so we ask the user to open the link in Safari instead.
 */
export function isInAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Twitter|LinkedIn|Snapchat|Pinterest|MicroMessenger|GSA\/|wv\)/i.test(
    userAgent
  );
}

export function parseIosMajorVersion(userAgent: string): number | null {
  const match = /OS (\d+)_(\d+)/.exec(userAgent);
  return match ? Number.parseInt(match[1], 10) : null;
}

/** iOS 18 is the supported floor. */
export function isSupportedIosVersion(userAgent: string): boolean {
  if (!isIosDevice(userAgent)) return true;
  const major = parseIosMajorVersion(userAgent);
  return major === null || major >= 18;
}

export function isStandaloneMode(
  displayModeStandalone: boolean,
  navigatorStandalone: boolean | undefined
): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

export const DEFAULT_PWA_STATE = {
  isIos: false,
  isSafari: false,
  isInApp: false,
  standalone: false,
  supportedIos: true,
  iosMajor: null as number | null,
};

/** Safe client-side snapshot; returns the SSR default outside the browser. */
export function getClientPwaState() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ...DEFAULT_PWA_STATE };
  }

  const ua = navigator.userAgent;
  const standalone = isStandaloneMode(
    window.matchMedia('(display-mode: standalone)').matches,
    (navigator as Navigator & { standalone?: boolean }).standalone
  );

  return {
    isIos: isIosDevice(ua, navigator.platform, navigator.maxTouchPoints),
    isSafari: isIosSafari(ua, navigator.platform, navigator.maxTouchPoints),
    isInApp: isInAppBrowser(ua),
    standalone,
    supportedIos: isSupportedIosVersion(ua),
    iosMajor: parseIosMajorVersion(ua),
  };
}
