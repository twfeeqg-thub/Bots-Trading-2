'use client';

import React from 'react';
import { Palette, Paintbrush } from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from './ThemeContext';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { 
    isCustomizerOpen, 
    setIsCustomizerOpen, 
    accent, 
    isLight, 
    theme 
  } = useTheme();

  const currentPalette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  return (
    <>
      <button
        type="button"
        id="theme-customizer-btn"
        suppressHydrationWarning
        aria-label="تخصيص ألوان الثيم ومظهر التطبيق"
        title="تخصيص مظهر التطبيق وألوان الثيم"
        onClick={() => setIsCustomizerOpen(true)}
        className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 shadow-xs hover:scale-[1.02] active:scale-[0.98] ${
          isLight
            ? 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50'
            : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
        } ${className}`}
        style={{
          boxShadow: `0 0 10px ${currentPalette.badgeBg}`,
        }}
      >
        {/* Swatch Icon with Palette/Paintbrush */}
        <div
          className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-950 transition-colors shadow-xs"
          style={{ backgroundColor: currentPalette.primaryColor }}
        >
          <Paintbrush className="w-3 h-3 stroke-2.5" />
        </div>

        {/* Button Title */}
        <span className="flex items-center gap-1">
          <Palette className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
          <span className="font-semibold tracking-wide">🎨 ألوان الثيم</span>
        </span>

        {/* Small Active Color Dot / Emoji indicator */}
        <span 
          className="w-2.5 h-2.5 rounded-full inline-block ring-2 ring-slate-800 shadow-xs"
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
