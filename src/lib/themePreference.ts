export type ThemePreference = 'dark' | 'light';
export type ThemeScope = 'coach' | 'athlete';

export const THEME_STORAGE_KEY = 'topset-theme';
export const DEFAULT_THEME: ThemePreference = 'dark';

export function themeStorageKey(scope?: ThemeScope): string {
  return scope ? `${THEME_STORAGE_KEY}:${scope}` : THEME_STORAGE_KEY;
}

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light';
}

export function readThemePreference(storage?: ThemeStorage | null, scope?: ThemeScope): ThemePreference {
  try {
    const source = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    const stored = source?.getItem(themeStorageKey(scope));
    // Older versions stored one device-wide value. Use it as the starting
    // preference for each role until that role chooses its own theme.
    const legacy = scope && !isThemePreference(stored) ? source?.getItem(THEME_STORAGE_KEY) : null;
    return isThemePreference(stored) ? stored : isThemePreference(legacy) ? legacy : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeThemePreference(theme: ThemePreference, storage?: ThemeStorage | null, scope?: ThemeScope): void {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    target?.setItem(themeStorageKey(scope), theme);
  } catch {
    // Theme selection remains active for this page even when storage is blocked.
  }
}
