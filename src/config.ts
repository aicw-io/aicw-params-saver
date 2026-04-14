import { ParamsSaverConfig } from './types';

export const DEFAULT_CONFIG: ParamsSaverConfig = {
  debug: false,

  // Parameters - common tracking params (startsWith matching)
  params: ['utm_', 'gclid', 'fbclid', 'msclkid', 'ref'],

  // Storage - localStorage only (GDPR-compliant, no cookies by default)
  storage: 'localStorage',
  ttl: 30, // 30 days

  // Link decoration (first domain also used as cookie domain when cookies enabled)
  allowedDomains: [], // Current domain only
  excludePatterns: [
    '*.exe',
    '*.msi',
    '*.dmg',
    '*.pkg',
    '*.zip',
    '*.rar',
    '*.7z',
    '*.tar*',
    '*.pdf',
    'mailto:*',
    'tel:*',
    'javascript:*',
    '*logout*',
    '*signout*',
    '*unsubscribe*',
  ],

  // Attribution - pure first-touch by default
  mergeParams: false,

  onCapture: undefined,
};

// Hardcoded constants
export const STORAGE_PREFIX = 'pz_';
export const EXCLUDE_SELECTOR = '[data-pz-ignore], .pz-ignore';
