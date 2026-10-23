'use client';

import React from 'react';
import { Palette, Paintbrush, Laptop, Moon, Sun } from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from './ThemeContext';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Quick 1-click mode toggle (System -> Dark -> Light -> System)
 * with expressive icons: Laptop, Moon, Sun.
 */
export function ThemeQuickToggle({ className = '' }: { className?: string }) {
  const { themeMode, cycleThemeMode, isLight } = useTheme();

  const getModeDetails = () => {
    switch (themeMode) {
      case 'system':
        return {
          icon: <Laptop className="w-3.5 h-3.5" />,
          label: 'تلقائي النظام',
          nextLabel: 'التحويل للوضع الداكن',
        };
      case 'dark':
        return {
          icon: <Moon className="w-3.5 h-3.5" />,
          label: 'داكن',
          nextLabel: 'التحويل للوضع الفاتح',
        };
      case 'light':
        return {
          icon: <Sun className="w-3.5 h-3.5" />,
          label: 'فاتح',
          nextLabel: 'التحويل للوضع التلقائي',
        };
    }
  };

  const current = getModeDetails();

  return (
    <button
      type="button"
      id="theme-quick-mode-btn"
      suppressHydrationWarning
      onClick={cycleThemeMode}
      title={`وضع الإضاءة الحالي: ${current.label} — انقر للتبديل (${current.nextLabel})`}
      aria-label={`تبديل وضع الإضاءة: ${current.label}`}
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/40 hover:scale-[1.02] active:scale-[0.98] ${
        isLight
          ? 'bg-white/90 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
      } ${className}`}
    >
      <span className="text-amber-500">{current.icon}</span>
      <span className="hidden sm:inline font-mono text-[11px]">{current.label}</span>
    </button>
  );
}

/**
 * Prominent permanent button titled "🎨 ألوان الثيم" with paintbrush/palette icon
 * opening the comprehensive ThemeCustomizerModal.
 */
export function ThemePaletteButton({ className = '' }: { className?: string }) {
  const {
    isCustomizerOpen,
    setIsCustomizerOpen,
    accent,
    isLight,
  } = useTheme();

  const currentPalette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.amber;

  return (
    <>
      <button
        type="button"
        id="theme-customizer-btn"
        suppressHydrationWarning
        aria-label="تخصيص ألوان الثيم ومظهر التطبيق"
        title="تخصيص مظهر التطبيق وألوان الثيم"
        onClick={() => setIsCustomizerOpen(true)}
        className={`group relative inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/40 shadow-xs hover:scale-[1.02] active:scale-[0.98] ${
          isLight
            ? 'bg-white/95 border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50'
            : 'bg-slate-900/95 border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
        } ${className}`}
        style={{
          boxShadow: `0 0 12px ${currentPalette.badgeBg}`,
        }}
      >
        {/* Paintbrush Swatch */}
        <div
          className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-950 transition-colors shadow-xs shrink-0"
          style={{ backgroundColor: currentPalette.primaryColor }}
        >
          <Paintbrush className="w-3 h-3 stroke-2.5" />
        </div>

        {/* Button Title */}
        <span className="flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 transition-colors hidden xs:inline" />
          <span className="font-semibold tracking-wide hidden sm:inline">🎨 ألوان الثيم</span>
          <span className="font-semibold tracking-wide sm:hidden text-[11px]">الثيم</span>
        </span>

        {/* Small Active Color Dot */}
        <span
          className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full inline-block ring-2 ring-slate-800 shadow-xs shrink-0"
          style={{ backgroundColor: currentPalette.primaryColor }}
          title={currentPalette.nameAr}
        />
      </button>

      {/* Independent Theme Customizer Modal */}
      <ThemeCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
      />
    </>
  );
}

/**
 * Combined Theme Controls: Quick Toggle + Prominent Palette Customizer Button
 */
export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <ThemeQuickToggle />
      <ThemePaletteButton />
    </div>
  );
}
