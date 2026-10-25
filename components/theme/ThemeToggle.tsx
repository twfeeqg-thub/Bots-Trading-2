'use client';

import React, { useState } from 'react';
import { Sun, Moon, Palette, Check } from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from './ThemeContext';

export function ThemeToggle() {
  const { theme, isLight, accent, setTheme, setAccent, toggleTheme } = useTheme();
  const [showPalettes, setShowPalettes] = useState(false);

  return (
    <div className="relative flex items-center gap-1">
      {/* Light / Dark Mode Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="تبديل الوضع الليلي / النهاري"
        className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer ${
          isLight
            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
        }`}
        title={isLight ? 'التحويل للوضع الليلي' : 'التحويل للوضع النهاري'}
      >
        {isLight ? <Moon className="w-4 h-4 text-amber-500" /> : <Sun className="w-4 h-4 text-amber-400" />}
      </button>

      {/* Palette Selector Button */}
      <button
        type="button"
        onClick={() => setShowPalettes(!showPalettes)}
        aria-label="اختيار لوحة الألوان"
        className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer ${
          isLight
            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
            : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-200'
        }`}
        title="تخصيص لوحة الألوان"
      >
        <Palette className="w-4 h-4" style={{ color: ACCENT_PALETTES[accent]?.primaryColor || '#f59e0b' }} />
      </button>

      {/* Palettes Dropdown */}
      {showPalettes && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPalettes(false)}
          />
          <div
            className={`absolute left-0 sm:right-auto sm:left-0 top-full mt-2 z-50 p-3 rounded-2xl border shadow-2xl min-w-[210px] backdrop-blur-xl transition-all ${
              isLight
                ? 'bg-white/95 border-slate-200 text-slate-900'
                : 'bg-slate-950/95 border-slate-800 text-slate-100'
            }`}
          >
            <div className="text-xs font-semibold mb-2.5 pb-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span>لوحات ألوان الواجهة</span>
              <span className="text-[10px] text-slate-400">مشروع Q</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(ACCENT_PALETTES).map(([key, pal]) => {
                const isSelected = accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setAccent(key);
                      setShowPalettes(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? isLight ? 'bg-slate-100 font-bold' : 'bg-slate-800/80 font-bold'
                        : isLight ? 'hover:bg-slate-100/60' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 shadow-xs"
                        style={{ backgroundColor: pal.primaryColor }}
                      />
                      <span>{pal.label}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5" style={{ color: pal.primaryColor }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
