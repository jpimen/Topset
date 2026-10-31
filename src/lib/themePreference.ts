export type ThemePreference = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'topset-theme';
export const DEFAULT_THEME: ThemePreference = 'dark';

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'dark' || value === 'light';
}

export function readThemePreference(storage?: ThemeStorage | null): ThemePreference {
  try {
    const source = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    const stored = source?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeThemePreference(theme: ThemePreference, storage?: ThemeStorage | null): void {
  try {
    const target = storage ?? (typeof window === 'undefined' ? null : window.localStorage);
    target?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme selection remains active for this page even when storage is blocked.
  }
}
