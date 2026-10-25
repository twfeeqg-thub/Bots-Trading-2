'use client';

import React from 'react';
import { useTheme, ACCENT_PALETTES } from './ThemeContext';

export function WorkspaceBackground() {
  const { isLight, accent } = useTheme();
  const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-colors duration-500"
      style={{
        backgroundColor: isLight ? '#f8fafc' : '#030712',
      }}
    >
      {/* Subtle radial glow matching current accent */}
      <div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-15 transition-all duration-700"
        style={{ backgroundColor: palette.primaryColor }}
      />
      <div
        className="absolute top-1/3 -right-40 w-96 h-96 rounded-full blur-3xl opacity-10 transition-all duration-700"
        style={{ backgroundColor: palette.primaryColor }}
      />
      {/* Light subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, ${isLight ? '#000' : '#fff'} 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );
}
