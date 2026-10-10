'use client';

import React from 'react';
import { useTheme } from './ThemeContext';
import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = true }: ThemeToggleProps) {
  const { isLight, toggleTheme } = useTheme();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        role="switch"
        suppressHydrationWarning
        aria-checked={isLight}
        aria-label="التبديل بين الوضع المظلم والوضع الفاتح"
        onClick={toggleTheme}
        title={isLight ? 'التبديل إلى الوضع المظلم' : 'التبديل إلى الوضع الفاتح'}
        className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ${
          isLight
            ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 shadow-sm'
            : 'bg-slate-950/80 border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-slate-100'
        }`}
      >
        {/* Toggle Switch Visual Track */}
        <div
          className={`w-8 h-4.5 rounded-full transition-colors duration-200 p-0.5 flex items-center ${
            isLight ? 'bg-amber-400 justify-end' : 'bg-slate-700 justify-start'
          }`}
        >
          {/* Thumb */}
          <div
            className={`w-3.5 h-3.5 rounded-full shadow-xs flex items-center justify-center transition-all ${
              isLight ? 'bg-white text-amber-600' : 'bg-slate-200 text-slate-800'
            }`}
          >
            {isLight ? (
              <Sun className="w-2.5 h-2.5" />
            ) : (
              <Moon className="w-2.5 h-2.5" />
            )}
          </div>
        </div>

        {/* Labels & Icons */}
        <div className="flex items-center gap-1.5">
          {isLight ? (
            <span className="flex items-center gap-1 text-amber-800 font-semibold tracking-wide">
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              <span>الوضع الفاتح</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-300">
              <Moon className="w-3.5 h-3.5 text-slate-400" />
              <span>الوضع المظلم</span>
            </span>
          )}
        </div>

        {/* Small Mode Indicator Pill */}
        {showLabel && (
          <span
            className={`hidden sm:inline-flex items-center text-[10px] px-1.5 py-0.2 rounded border transition-colors ${
              isLight
                ? 'bg-amber-200/50 border-amber-300 text-amber-800 font-medium'
                : 'bg-slate-800/60 border-slate-700 text-slate-400'
            }`}
          >
            {isLight ? 'فاتح' : 'مظلم'}
          </span>
        )}
      </button>
    </div>
  );
}
