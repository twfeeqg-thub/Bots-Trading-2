'use client';

import React, { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Globe, Flame } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';
import { getCurrentTimeUtc3, MARKET_SESSIONS, calculateSessionStatus } from '@/lib/markets/sessions';

interface SessionStatusBadgeProps {
  onClick?: () => void;
  className?: string;
}

const emptySubscribe = () => () => {};

function subscribeTime(callback: () => void) {
  const timer = setInterval(callback, 10000);
  return () => clearInterval(timer);
}

export function SessionStatusBadge({ onClick, className = '' }: SessionStatusBadgeProps) {
  const { isLight } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const timeTick = useSyncExternalStore(subscribeTime, () => Math.floor(Date.now() / 10000), () => 0);

  const utc3 = useMemo(() => {
    return getCurrentTimeUtc3(mounted && timeTick > 0 ? new Date() : new Date(0));
  }, [mounted, timeTick]);

  const badgeInfo = useMemo(() => {
    // Check London + NY Overlap (Golden)
    if (utc3.hours >= 16 && utc3.hours < 20) {
      return {
        label: 'تداخل لندن + نيويورك (ذروة السيولة)',
        shortLabel: 'تداخل لندن + NY',
        isPeak: true,
        dotColor: 'bg-amber-400',
        badgeClass: isLight 
          ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100' 
          : 'bg-amber-950/40 border-amber-500/40 text-amber-300 hover:bg-amber-900/40',
      };
    }

    // Check Tokyo + London Overlap
    if (utc3.hours >= 10 && utc3.hours < 11) {
      return {
        label: 'تداخل طوكيو + لندن',
        shortLabel: 'تداخل طوكيو + لندن',
        isPeak: false,
        dotColor: 'bg-blue-400',
        badgeClass: isLight 
          ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100' 
          : 'bg-blue-950/40 border-blue-500/40 text-blue-300 hover:bg-blue-900/40',
      };
    }

    // Single active sessions
    const statuses = MARKET_SESSIONS.map((s) => calculateSessionStatus(s, utc3.totalMinutesOfDay));
    const openNewYork = statuses.find((s) => s.session.id === 'newyork')?.isOpen;
    const openLondon = statuses.find((s) => s.session.id === 'london')?.isOpen;
    const openTokyo = statuses.find((s) => s.session.id === 'tokyo')?.isOpen;
    const openSydney = statuses.find((s) => s.session.id === 'sydney')?.isOpen;

    if (openNewYork) {
      return {
        label: 'الجلسة الأمريكية نشطة (نيويورك)',
        shortLabel: 'جلسة نيويورك',
        isPeak: false,
        dotColor: 'bg-emerald-400',
        badgeClass: isLight 
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100' 
          : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40',
      };
    }

    if (openLondon) {
      return {
        label: 'الجلسة الأوروبية نشطة (لندن)',
        shortLabel: 'جلسة لندن',
        isPeak: false,
        dotColor: 'bg-blue-400',
        badgeClass: isLight 
          ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100' 
          : 'bg-blue-950/40 border-blue-500/40 text-blue-300 hover:bg-blue-900/40',
      };
    }

    if (openTokyo) {
      return {
        label: 'الجلسة الآسيوية نشطة (طوكيو)',
        shortLabel: 'جلسة طوكيو',
        isPeak: false,
        dotColor: 'bg-violet-400',
        badgeClass: isLight 
          ? 'bg-violet-50 border-violet-300 text-violet-900 hover:bg-violet-100' 
          : 'bg-violet-950/40 border-violet-500/40 text-violet-300 hover:bg-violet-900/40',
      };
    }

    if (openSydney) {
      return {
        label: 'جلسة سيدني نشطة (سيولة هادئة)',
        shortLabel: 'جلسة سيدني',
        isPeak: false,
        dotColor: 'bg-sky-400',
        badgeClass: isLight 
          ? 'bg-sky-50 border-sky-300 text-sky-900 hover:bg-sky-100' 
          : 'bg-sky-950/40 border-sky-500/40 text-sky-300 hover:bg-sky-900/40',
      };
    }

    return {
      label: 'الأسواق العالمية',
      shortLabel: 'الأسواق',
      isPeak: false,
      dotColor: 'bg-slate-400',
      badgeClass: isLight 
        ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' 
        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800',
    };
  }, [utc3, isLight]);

  if (!mounted) {
    return (
      <button
        type="button"
        onClick={onClick}
        suppressHydrationWarning
        title="انقر للانتقال لشاشة الأسواق وجلسات السيولة العالمية"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer shadow-2xs select-none bg-slate-900 border-slate-700 text-slate-300 ${className}`}
      >
        <Globe className="w-3.5 h-3.5 opacity-80" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
        <span className="hidden sm:inline font-semibold">الأسواق العالمية</span>
        <span className="sm:hidden font-semibold">الأسواق</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      suppressHydrationWarning
      title="انقر للانتقال لشاشة الأسواق وجلسات السيولة العالمية"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer shadow-2xs select-none ${badgeInfo.badgeClass} ${className}`}
    >
      {badgeInfo.isPeak ? (
        <Flame className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
      ) : (
        <Globe className="w-3.5 h-3.5 opacity-80" />
      )}
      <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dotColor} animate-pulse`} />
      <span className="hidden sm:inline font-semibold">{badgeInfo.label}</span>
      <span className="sm:hidden font-semibold">{badgeInfo.shortLabel}</span>
    </button>
  );
}
