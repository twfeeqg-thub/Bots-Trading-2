'use client';

import React from 'react';
import { useTheme, ACCENT_PALETTES } from './ThemeContext';

export function WorkspaceBackground() {
  const { accent, isLight, theme } = useTheme();
  const currentPalette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.amber || ACCENT_PALETTES.gold;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
    >
      {/* 1. Base Dark/Light Ambient Canvas */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isLight ? 'bg-slate-50' : 'bg-[#020617]'
        }`}
      />

      {/* 2. Ambient radial glow matching current accent at top center */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[950px] h-[360px] opacity-20 sm:opacity-25 blur-3xl pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${currentPalette.primaryColor} 0%, transparent 70%)`,
        }}
      />

      {/* 3. Ambient subtle lighting on corner */}
      <div
        className="absolute bottom-0 right-0 w-[450px] h-[300px] opacity-10 blur-3xl pointer-events-none transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${currentPalette.primaryColor} 0%, transparent 70%)`,
        }}
      />

      {/* 4. Geometric Grid: subtle repeating grid pattern */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#64748b15_1px,transparent_1px),linear-gradient(to_bottom,#64748b15_1px,transparent_1px)] bg-[size:32px_32px]"
      />

      {/* 5. Top technical monospace identity tag with pulsing light dot */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 hidden md:flex items-center gap-2 px-3 py-0.5 rounded-full border border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md font-mono text-[10px] text-slate-500 dark:text-slate-400 shadow-xs z-0">
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
          style={{ backgroundColor: currentPalette.primaryColor }}
        />
        <span className="font-semibold tracking-wider">
          Q-SYSTEM {'//'} AMBIENT_MODE: {theme.toUpperCase()} {'//'} ACCENT: {accent.toUpperCase()} ({currentPalette.nameAr})
        </span>
      </div>
    </div>
  );
}
