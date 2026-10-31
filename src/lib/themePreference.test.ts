import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_STORAGE_KEY, readThemePreference, storeThemePreference } from './themePreference';

describe('theme preference', () => {
  it('uses a saved light or dark choice', () => {
    const storage = { getItem: () => 'light', setItem: () => undefined };
    expect(readThemePreference(storage)).toBe('light');
    expect(readThemePreference({ ...storage, getItem: () => 'dark' })).toBe('dark');
  });

  it('defaults to dark for missing or corrupted values', () => {
    expect(readThemePreference({ getItem: () => null, setItem: () => undefined })).toBe(DEFAULT_THEME);
    expect(readThemePreference({ getItem: () => 'system', setItem: () => undefined })).toBe(DEFAULT_THEME);
  });

  it('falls back when storage access is blocked', () => {
    const blocked = {
      getItem: () => { throw new Error('storage blocked'); },
      setItem: () => { throw new Error('storage blocked'); },
    };
    expect(readThemePreference(blocked)).toBe(DEFAULT_THEME);
    expect(() => storeThemePreference('light', blocked)).not.toThrow();
  });

  it('persists the chosen theme under the Topset preference key', () => {
    let savedKey = '';
    let savedValue = '';
    storeThemePreference('light', { getItem: () => null, setItem: (key, value) => { savedKey = key; savedValue = value; } });
    expect(savedKey).toBe(THEME_STORAGE_KEY);
    expect(savedValue).toBe('light');
  });
});
