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
export type AccentColor = 'amber' | 'emerald' | 'cyan' | 'violet' | 'gold';

export interface AccentColorDefinition {
  id: 'amber' | 'emerald' | 'cyan' | 'violet';
  name: string;
  nameAr: string;
  emoji: string;
  primaryColor: string;
  hoverColor: string;
  badgeBg: string;
  badgeBorder: string;
  previewRing: string;
  description: string;
  sectionBgDark: string;
  sectionBorderDark: string;
  cardBgDark: string;
  cardBorderDark: string;
  headingColorDark: string;
  sectionBgLight: string;
  sectionBorderLight: string;
  cardBgLight: string;
  cardBorderLight: string;
  headingColorLight: string;
}

export const ACCENT_PALETTES: Record<'amber' | 'emerald' | 'cyan' | 'violet' | 'gold', AccentColorDefinition> = {
  amber: {
    id: 'amber',
    name: 'Binance Gold',
    nameAr: 'الذهبي الكلاسيكي (Binance Gold)',
    emoji: '🟡',
    primaryColor: '#f0b90b',
    hoverColor: '#d97706',
    badgeBg: 'rgba(240, 185, 11, 0.15)',
    badgeBorder: 'rgba(240, 185, 11, 0.4)',
    previewRing: 'ring-amber-500/40',
    description: 'اللون الأصلي الافتراضي الفاخر المستوحى من منصات التداول العالمية مع توهج ذهبي جذاب',
    sectionBgDark: 'rgba(24, 20, 13, 0.88)',
    sectionBorderDark: 'rgba(240, 185, 11, 0.24)',
    cardBgDark: 'rgba(30, 24, 15, 0.92)',
    cardBorderDark: 'rgba(240, 185, 11, 0.3)',
    headingColorDark: '#fcd34d',
    sectionBgLight: 'rgba(255, 251, 235, 0.92)',
    sectionBorderLight: 'rgba(217, 119, 6, 0.24)',
    cardBgLight: 'rgba(255, 255, 255, 0.96)',
    cardBorderLight: 'rgba(217, 119, 6, 0.28)',
    headingColorLight: '#92400e',
  },
  gold: {
    id: 'amber',
    name: 'Binance Gold',
    nameAr: 'الذهبي الكلاسيكي (Binance Gold)',
    emoji: '🟡',
    primaryColor: '#f0b90b',
    hoverColor: '#d97706',
    badgeBg: 'rgba(240, 185, 11, 0.15)',
    badgeBorder: 'rgba(240, 185, 11, 0.4)',
    previewRing: 'ring-amber-500/40',
    description: 'اللون الأصلي الافتراضي الفاخر المستوحى من منصات التداول العالمية مع توهج ذهبي جذاب',
    sectionBgDark: 'rgba(24, 20, 13, 0.88)',
    sectionBorderDark: 'rgba(240, 185, 11, 0.24)',
    cardBgDark: 'rgba(30, 24, 15, 0.92)',
    cardBorderDark: 'rgba(240, 185, 11, 0.3)',
    headingColorDark: '#fcd34d',
    sectionBgLight: 'rgba(255, 251, 235, 0.92)',
    sectionBorderLight: 'rgba(217, 119, 6, 0.24)',
    cardBgLight: 'rgba(255, 255, 255, 0.96)',
    cardBorderLight: 'rgba(217, 119, 6, 0.28)',
    headingColorLight: '#92400e',
  },
  emerald: {
    id: 'emerald',
    name: 'Bullish Gain',
    nameAr: 'الأخضر الزمردي (Bullish Gain)',
    emoji: '🟢',
    primaryColor: '#10b981',
    hoverColor: '#059669',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
    previewRing: 'ring-emerald-500/40',
    description: 'طابع السيولة الصاعدة وصفقات الشراء الخضراء مع طاقة تداول إيجابية وحيوية',
    sectionBgDark: 'rgba(6, 26, 20, 0.88)',
    sectionBorderDark: 'rgba(16, 185, 129, 0.24)',
    cardBgDark: 'rgba(8, 34, 26, 0.92)',
    cardBorderDark: 'rgba(16, 185, 129, 0.3)',
    headingColorDark: '#6ee7b7',
    sectionBgLight: 'rgba(236, 253, 245, 0.92)',
    sectionBorderLight: 'rgba(5, 150, 105, 0.24)',
    cardBgLight: 'rgba(255, 255, 255, 0.96)',
    cardBorderLight: 'rgba(5, 150, 105, 0.28)',
    headingColorLight: '#065f46',
  },
  cyan: {
    id: 'cyan',
    name: 'Cyber Cyan',
    nameAr: 'الأزرق السيبراني (Cyber Cyan)',
    emoji: '🔵',
    primaryColor: '#06b6d4',
    hoverColor: '#0891b2',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    badgeBorder: 'rgba(6, 182, 212, 0.4)',
    previewRing: 'ring-cyan-500/40',
    description: 'طابع نيوني تقني مستقبلي عالي الوضوح ومريح جداً للعين خلال فترات المراقبة الطويلة',
    sectionBgDark: 'rgba(6, 26, 36, 0.88)',
    sectionBorderDark: 'rgba(6, 182, 212, 0.24)',
    cardBgDark: 'rgba(8, 34, 46, 0.92)',
    cardBorderDark: 'rgba(6, 182, 212, 0.3)',
    headingColorDark: '#67e8f9',
    sectionBgLight: 'rgba(236, 254, 255, 0.92)',
    sectionBorderLight: 'rgba(8, 145, 178, 0.24)',
    cardBgLight: 'rgba(255, 255, 255, 0.96)',
    cardBorderLight: 'rgba(8, 145, 178, 0.28)',
    headingColorLight: '#155e75',
  },
  violet: {
    id: 'violet',
    name: 'Web3 Crypto',
    nameAr: 'البنفسجي العصري (Web3 Crypto)',
    emoji: '🟣',
    primaryColor: '#8b5cf6',
    hoverColor: '#7c3aed',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeBorder: 'rgba(139, 92, 246, 0.4)',
    previewRing: 'ring-purple-500/40',
    description: 'طابع تقني فاخر مستوحى من بروتوكولات وتطبيقات Web3 والتمويل اللامركزي الحديث',
    sectionBgDark: 'rgba(24, 14, 40, 0.88)',
    sectionBorderDark: 'rgba(139, 92, 246, 0.24)',
    cardBgDark: 'rgba(30, 18, 50, 0.92)',
    cardBorderDark: 'rgba(139, 92, 246, 0.3)',
    headingColorDark: '#c4b5fd',
    sectionBgLight: 'rgba(245, 243, 255, 0.92)',
    sectionBorderLight: 'rgba(124, 58, 237, 0.24)',
    cardBgLight: 'rgba(255, 255, 255, 0.96)',
    cardBorderLight: 'rgba(124, 58, 237, 0.28)',
    headingColorLight: '#5b21b6',
  },
};

export interface ThemeContextType {
  themeMode: ThemeModePreference;
  modePreference: ThemeModePreference; // backward compatible alias
  theme: ThemeMode; // resolved 'dark' | 'light'
  isLight: boolean;
  isDark: boolean;
  accent: 'amber' | 'emerald' | 'cyan' | 'violet';
  accentColor: 'amber' | 'emerald' | 'cyan' | 'violet'; // alias
  setThemeMode: (mode: ThemeModePreference) => void;
  setModePreference: (pref: ThemeModePreference) => void; // alias
  setAccentColor: (accent: 'amber' | 'emerald' | 'cyan' | 'violet') => void;
  setAccent: (accent: 'amber' | 'emerald' | 'cyan' | 'violet' | 'gold') => void; // alias
  cycleThemeMode: () => void;
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
    const legacy = localStorage.getItem('project_q_theme_mode');
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {}
  return 'dark';
}

function normalizeAccent(val: string | null): 'amber' | 'emerald' | 'cyan' | 'violet' {
  if (val === 'emerald' || val === 'cyan' || val === 'violet') return val;
  return 'amber'; // 'gold', 'amber', or default
}

function getStoredAccent(): 'amber' | 'emerald' | 'cyan' | 'violet' {
  if (typeof window === 'undefined') return 'amber';
  try {
    const val = localStorage.getItem(STORAGE_ACCENT_KEY);
    return normalizeAccent(val);
  } catch {}
  return 'amber';
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

function applyThemeToDocument(mode: ThemeMode, accent: 'amber' | 'emerald' | 'cyan' | 'violet') {
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

  // Apply accent attribute (this powers CSS variables overrides in globals.css)
  root.setAttribute('data-accent', accent);
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  modePreference: 'dark',
  theme: 'dark',
  isLight: false,
  isDark: true,
  accent: 'amber',
  accentColor: 'amber',
  setThemeMode: () => {},
  setModePreference: () => {},
  setAccentColor: () => {},
  setAccent: () => {},
  cycleThemeMode: () => {},
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

  const getServerSnapshot = useCallback(() => 'dark:amber', []);

  const stateStr = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [rawModePref, rawAccent] = (mounted ? stateStr : 'dark:amber').split(':') as [
    ThemeModePreference,
    string
  ];

  const modePreference = mounted ? rawModePref : 'dark';
  const themeMode = modePreference;
  const accent = normalizeAccent(rawAccent);
  const theme = resolveMode(modePreference);
  const isLight = theme === 'light';
  const isDark = !isLight;

  useEffect(() => {
    if (mounted) {
      applyThemeToDocument(theme, accent);
    }
  }, [mounted, theme, accent]);

  const setThemeMode = useCallback(
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

  const setAccentColor = useCallback(
    (newAccent: 'amber' | 'emerald' | 'cyan' | 'violet' | 'gold') => {
      try {
        const normalized = normalizeAccent(newAccent);
        localStorage.setItem(STORAGE_ACCENT_KEY, normalized);
        applyThemeToDocument(theme, normalized);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      } catch {}
    },
    [theme]
  );

  const cycleThemeMode = useCallback(() => {
    const order: ThemeModePreference[] = ['system', 'dark', 'light'];
    const currentIndex = order.indexOf(modePreference);
    const nextIndex = (currentIndex + 1) % order.length;
    setThemeMode(order[nextIndex]);
  }, [modePreference, setThemeMode]);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setThemeMode(next);
  }, [theme, setThemeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      modePreference,
      theme,
      isLight,
      isDark,
      accent,
      accentColor: accent,
      setThemeMode,
      setModePreference: setThemeMode,
      setAccentColor,
      setAccent: setAccentColor,
      cycleThemeMode,
      toggleTheme,
      setTheme: (t: ThemeMode) => setThemeMode(t),
      isCustomizerOpen,
      setIsCustomizerOpen,
      mounted,
    }),
    [
      themeMode,
      modePreference,
      theme,
      isLight,
      isDark,
      accent,
      setThemeMode,
      setAccentColor,
      cycleThemeMode,
      toggleTheme,
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
