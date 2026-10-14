'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

export type ThemeModePreference = 'system' | 'dark' | 'light';
export type ThemeMode = 'dark' | 'light';
export type AccentColor = 'gold' | 'emerald' | 'cyan' | 'violet';

export interface AccentColorDefinition {
  id: AccentColor;
  name: string;
  nameAr: string;
  emoji: string;
  primaryColor: string;
  hoverColor: string;
  badgeBg: string;
  badgeBorder: string;
  previewRing: string;
}

export const ACCENT_PALETTES: Record<AccentColor, AccentColorDefinition> = {
  gold: {
    id: 'gold',
    name: 'Binance Gold',
    nameAr: 'ذهبي Binance الأصلي',
    emoji: '🟡',
    primaryColor: '#f0b90b',
    hoverColor: '#d97706',
    badgeBg: 'rgba(240, 185, 11, 0.15)',
    badgeBorder: 'rgba(240, 185, 11, 0.4)',
    previewRing: 'ring-amber-400',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Green',
    nameAr: 'أخضر زمردي',
    emoji: '🟢',
    primaryColor: '#10b981',
    hoverColor: '#059669',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
    previewRing: 'ring-emerald-400',
  },
  cyan: {
    id: 'cyan',
    name: 'Cyber Cyan',
    nameAr: 'أزرق سيبراني',
    emoji: '🔵',
    primaryColor: '#06b6d4',
    hoverColor: '#0891b2',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeBorder: 'rgba(6, 182, 212, 0.4)',
    previewRing: 'ring-cyan-400',
  },
  violet: {
    id: 'violet',
    name: 'Crypto Violet',
    nameAr: 'بنفسجي عصري',
    emoji: '🟣',
    primaryColor: '#8b5cf6',
    hoverColor: '#7c3aed',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeBorder: 'rgba(139, 92, 246, 0.4)',
    previewRing: 'ring-purple-400',
  },
};

interface ThemeContextType {
  modePreference: ThemeModePreference;
  theme: ThemeMode; // resolved: 'dark' | 'light'
  isLight: boolean;
  isDark: boolean;
  accent: AccentColor;
  setModePreference: (pref: ThemeModePreference) => void;
  setAccent: (accent: AccentColor) => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  isCustomizerOpen: boolean;
  setIsCustomizerOpen: (open: boolean) => void;
  mounted: boolean;
}

const STORAGE_MODE_KEY = 'project_q_theme_mode_pref';
const STORAGE_ACCENT_KEY = 'project_q_theme_accent';
const THEME_CHANGE_EVENT = 'project_q_theme_change';

const emptySubscribe = () => () => {};

function getStoredModePref(): ThemeModePreference {
  if (typeof window === 'undefined') return 'dark';
  try {
    const val = localStorage.getItem(STORAGE_MODE_KEY);
    if (val === 'system' || val === 'light' || val === 'dark') return val;
    // Backward compatibility with previous storage key
    const legacy = localStorage.getItem('project_q_theme_mode');
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {}
  return 'dark';
}

function getStoredAccent(): AccentColor {
  if (typeof window === 'undefined') return 'gold';
  try {
    const val = localStorage.getItem(STORAGE_ACCENT_KEY);
    if (val === 'gold' || val === 'emerald' || val === 'cyan' || val === 'violet') return val;
  } catch {}
  return 'gold'; // Default to Binance Gold
}

function resolveMode(pref: ThemeModePreference): ThemeMode {
  if (pref === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return pref;
}

function applyThemeToDocument(mode: ThemeMode, accent: AccentColor) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Apply mode
  if (mode === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
  }

  // Apply accent attribute
  root.setAttribute('data-accent', accent);
}

const ThemeContext = createContext<ThemeContextType>({
  modePreference: 'dark',
  theme: 'dark',
  isLight: false,
  isDark: true,
  accent: 'gold',
  setModePreference: () => {},
  setAccent: () => {},
  toggleTheme: () => {},
  setTheme: () => {},
  isCustomizerOpen: false,
  setIsCustomizerOpen: () => {},
  mounted: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback);
    window.addEventListener(THEME_CHANGE_EVENT, callback);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => callback();
    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('storage', callback);
      window.removeEventListener(THEME_CHANGE_EVENT, callback);
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  const getSnapshot = useCallback(() => {
    const pref = getStoredModePref();
    const acc = getStoredAccent();
    return `${pref}:${acc}`;
  }, []);

  const getServerSnapshot = useCallback(() => 'dark:gold', []);

  const stateStr = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [rawModePref, rawAccent] = (mounted ? stateStr : 'dark:gold').split(':') as [
    ThemeModePreference,
    AccentColor
  ];

  const modePreference = mounted ? rawModePref : 'dark';
  const accent = (mounted ? rawAccent : 'gold') as AccentColor;
  const theme = resolveMode(modePreference);
  const isLight = theme === 'light';
  const isDark = !isLight;

  useEffect(() => {
    if (mounted) {
      applyThemeToDocument(theme, accent);
    }
  }, [mounted, theme, accent]);

  const setModePreference = useCallback(
    (pref: ThemeModePreference) => {
      try {
        localStorage.setItem(STORAGE_MODE_KEY, pref);
        const resolved = resolveMode(pref);
        localStorage.setItem('project_q_theme_mode', resolved);
        applyThemeToDocument(resolved, accent);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      } catch {}
    },
    [accent]
  );

  const setAccent = useCallback(
    (newAccent: AccentColor) => {
      try {
        localStorage.setItem(STORAGE_ACCENT_KEY, newAccent);
        applyThemeToDocument(theme, newAccent);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      } catch {}
    },
    [theme]
  );

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setModePreference(newTheme);
    },
    [setModePreference]
  );

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setModePreference(next);
  }, [theme, setModePreference]);

  const value = useMemo(
    () => ({
      modePreference,
      theme,
      isLight,
      isDark,
      accent,
      setModePreference,
      setAccent,
      toggleTheme,
      setTheme,
      isCustomizerOpen,
      setIsCustomizerOpen,
      mounted,
    }),
    [
      modePreference,
      theme,
      isLight,
      isDark,
      accent,
      setModePreference,
      setAccent,
      toggleTheme,
      setTheme,
      isCustomizerOpen,
      mounted,
    ]
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
