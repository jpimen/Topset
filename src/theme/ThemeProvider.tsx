import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { readThemePreference, storeThemePreference, type ThemePreference, type ThemeScope } from '../lib/themePreference';

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const pageColor = getComputedStyle(root).getPropertyValue('--page').trim();
  const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (pageColor && themeColorMeta) themeColorMeta.content = pageColor;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const scope: ThemeScope | undefined = pathname.startsWith('/coach') ? 'coach' : pathname.startsWith('/athlete') ? 'athlete' : undefined;
  const [theme, setThemeState] = useState<ThemePreference>(() => readThemePreference(undefined, scope));
  const setTheme = useCallback((nextTheme: ThemePreference) => {
    storeThemePreference(nextTheme, undefined, scope);
    setThemeState(nextTheme);
  }, [scope]);

  useLayoutEffect(() => setThemeState(readThemePreference(undefined, scope)), [scope]);
  useLayoutEffect(() => applyTheme(theme), [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
