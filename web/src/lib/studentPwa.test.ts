import { describe, expect, it } from 'vitest';
import {
  isInAppBrowser,
  isIosDevice,
  isIosSafari,
  isStandaloneMode,
  isSupportedIosVersion,
  parseIosMajorVersion,
} from './studentPwa';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPHONE_WHATSAPP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/WhatsApp]';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

describe('studentPwa', () => {
  it('detects iPhones and iPad desktop-mode', () => {
    expect(isIosDevice(IPHONE_SAFARI)).toBe(true);
    expect(isIosDevice(IPAD_DESKTOP_MODE, 'MacIntel', 5)).toBe(true);
    expect(isIosDevice(ANDROID_CHROME, 'Linux armv8l', 5)).toBe(false);
  });

  it('distinguishes Safari from other iOS browsers and in-app browsers', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(IPHONE_WHATSAPP)).toBe(false);
    expect(isInAppBrowser(IPHONE_WHATSAPP)).toBe(true);
    expect(isInAppBrowser(IPHONE_SAFARI)).toBe(false);
  });

  it('parses the iOS major version and enforces the iOS 18 floor', () => {
    expect(parseIosMajorVersion(IPHONE_SAFARI)).toBe(18);
    expect(parseIosMajorVersion(ANDROID_CHROME)).toBeNull();
    expect(isSupportedIosVersion(IPHONE_SAFARI)).toBe(true);
    expect(
      isSupportedIosVersion(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'
      )
    ).toBe(false);
    expect(isSupportedIosVersion(ANDROID_CHROME)).toBe(true);
  });

  it('detects standalone mode through either signal', () => {
    expect(isStandaloneMode(true, undefined)).toBe(true);
    expect(isStandaloneMode(false, true)).toBe(true);
    expect(isStandaloneMode(false, false)).toBe(false);
    expect(isStandaloneMode(false, undefined)).toBe(false);
  });
});
