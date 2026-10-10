'use client';

import React, { createContext, useContext, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  isLight: boolean;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  mounted: boolean;
}

const STORAGE_KEY = 'project_q_theme_mode';
const THEME_CHANGE_EVENT = 'project_q_theme_change';

const emptySubscribe = () => () => {};

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') return val;
  } catch {}
  return 'dark';
}

function applyThemeToDocument(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
  }
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isLight: false,
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
  mounted: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Mounted detection without calling setState in an effect
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback);
    window.addEventListener(THEME_CHANGE_EVENT, callback);
    return () => {
      window.removeEventListener('storage', handleEvent);
      window.removeEventListener(THEME_CHANGE_EVENT, handleEvent);
    };
    function handleEvent() {
      callback();
    }
  }, []);

  const getSnapshot = useCallback(() => {
    return getStoredTheme();
  }, []);

  const getServerSnapshot = useCallback(() => {
    return 'dark' as ThemeMode;
  }, []);

  const rawTheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // During SSR and initial client hydration pass (when mounted === false),
  // theme is guaranteed to be 'dark', producing identical HTML and VDOM.
  const theme = mounted ? rawTheme : 'dark';
  const isLight = mounted && rawTheme === 'light';
  const isDark = !isLight;

  // Synchronize CSS class on root <html> tag when mounted
  useEffect(() => {
    if (mounted) {
      applyThemeToDocument(theme);
    }
  }, [mounted, theme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
      applyThemeToDocument(newTheme);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    const current = getStoredTheme();
    const next: ThemeMode = current === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(STORAGE_KEY, next);
      applyThemeToDocument(next);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isLight,
      isDark,
      toggleTheme,
      setTheme,
      mounted,
    }),
    [theme, isLight, isDark, toggleTheme, setTheme, mounted]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

