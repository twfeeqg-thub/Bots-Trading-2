'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export interface AccentPalette {
  name: string;
  label: string;
  primaryColor: string;
  sectionBgLight: string;
  sectionBgDark: string;
  sectionBorderLight: string;
  sectionBorderDark: string;
  badgeBg: string;
  badgeBorder: string;
  headingColorLight: string;
  headingColorDark: string;
}

export const ACCENT_PALETTES: Record<string, AccentPalette> = {
  gold: {
    name: 'gold',
    label: 'ذهبي / كهرماني',
    primaryColor: '#f59e0b',
    sectionBgLight: 'rgba(255, 251, 235, 0.85)',
    sectionBgDark: 'rgba(15, 23, 42, 0.85)',
    sectionBorderLight: 'rgba(251, 191, 36, 0.3)',
    sectionBorderDark: 'rgba(245, 158, 11, 0.25)',
    badgeBg: 'rgba(245, 158, 11, 0.12)',
    badgeBorder: 'rgba(245, 158, 11, 0.3)',
    headingColorLight: '#b45309',
    headingColorDark: '#fbbf24',
  },
  amber: {
    name: 'amber',
    label: 'كهرماني كلاسيكي',
    primaryColor: '#d97706',
    sectionBgLight: 'rgba(254, 243, 199, 0.85)',
    sectionBgDark: 'rgba(17, 24, 39, 0.85)',
    sectionBorderLight: 'rgba(217, 119, 6, 0.3)',
    sectionBorderDark: 'rgba(217, 119, 6, 0.25)',
    badgeBg: 'rgba(217, 119, 6, 0.12)',
    badgeBorder: 'rgba(217, 119, 6, 0.3)',
    headingColorLight: '#92400e',
    headingColorDark: '#f59e0b',
  },
  emerald: {
    name: 'emerald',
    label: 'زمردي رقمي',
    primaryColor: '#10b981',
    sectionBgLight: 'rgba(236, 253, 245, 0.85)',
    sectionBgDark: 'rgba(6, 30, 24, 0.85)',
    sectionBorderLight: 'rgba(52, 211, 153, 0.3)',
    sectionBorderDark: 'rgba(16, 185, 129, 0.25)',
    badgeBg: 'rgba(16, 185, 129, 0.12)',
    badgeBorder: 'rgba(16, 185, 129, 0.3)',
    headingColorLight: '#047857',
    headingColorDark: '#34d399',
  },
  cyan: {
    name: 'cyan',
    label: 'سماوي تكنولوجي',
    primaryColor: '#06b6d4',
    sectionBgLight: 'rgba(236, 254, 255, 0.85)',
    sectionBgDark: 'rgba(8, 28, 38, 0.85)',
    sectionBorderLight: 'rgba(34, 211, 238, 0.3)',
    sectionBorderDark: 'rgba(6, 182, 212, 0.25)',
    badgeBg: 'rgba(6, 182, 212, 0.12)',
    badgeBorder: 'rgba(6, 182, 212, 0.3)',
    headingColorLight: '#0e7490',
    headingColorDark: '#22d3ee',
  },
  indigo: {
    name: 'indigo',
    label: 'نيلي مؤسسي',
    primaryColor: '#6366f1',
    sectionBgLight: 'rgba(238, 242, 255, 0.85)',
    sectionBgDark: 'rgba(15, 23, 50, 0.85)',
    sectionBorderLight: 'rgba(129, 140, 248, 0.3)',
    sectionBorderDark: 'rgba(99, 102, 241, 0.25)',
    badgeBg: 'rgba(99, 102, 241, 0.12)',
    badgeBorder: 'rgba(99, 102, 241, 0.3)',
    headingColorLight: '#4338ca',
    headingColorDark: '#818cf8',
  },
  rose: {
    name: 'rose',
    label: 'ياقوتي نشط',
    primaryColor: '#f43f5e',
    sectionBgLight: 'rgba(255, 241, 242, 0.85)',
    sectionBgDark: 'rgba(35, 15, 25, 0.85)',
    sectionBorderLight: 'rgba(251, 113, 133, 0.3)',
    sectionBorderDark: 'rgba(244, 63, 94, 0.25)',
    badgeBg: 'rgba(244, 63, 94, 0.12)',
    badgeBorder: 'rgba(244, 63, 94, 0.3)',
    headingColorLight: '#be123c',
    headingColorDark: '#fb7185',
  },
};

interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  isLight: boolean;
  accent: string;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
  setAccent: (accent: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isLight: false,
  accent: 'gold',
  setTheme: () => {},
  setAccent: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('dark');
  const [accent, setAccentState] = useState<string>('gold');
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storedTheme = (localStorage.getItem('project_q_theme_mode_pref') ||
        localStorage.getItem('project_q_theme_mode') ||
        'dark') as 'light' | 'dark' | 'system';
      let storedAccent = localStorage.getItem('project_q_theme_accent') || 'gold';
      if (storedAccent === 'amber') storedAccent = 'gold';

      setThemeState(storedTheme);
      setAccentState(storedAccent in ACCENT_PALETTES ? storedAccent : 'gold');
    } catch {
      // Ignore localStorage access errors
    }
    setMounted(true);
  }, []);

  const isLight = useMemo(() => {
    if (!mounted) return false;
    if (theme === 'light') return true;
    if (theme === 'dark') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return !window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('project_q_theme_mode_pref', theme);
      localStorage.setItem('project_q_theme_accent', accent);
      const root = document.documentElement;
      if (isLight) {
        root.classList.add('light');
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-theme', 'dark');
      }
      root.setAttribute('data-accent', accent);
    } catch {
      // Ignore
    }
  }, [theme, accent, isLight, mounted]);

  const setTheme = (mode: 'light' | 'dark' | 'system') => {
    setThemeState(mode);
  };

  const setAccent = (newAccent: string) => {
    if (newAccent in ACCENT_PALETTES) {
      setAccentState(newAccent);
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, isLight, accent, setTheme, setAccent, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
