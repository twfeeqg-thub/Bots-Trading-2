'use client';

import React, { useState, useEffect } from 'react';
import { Globe, Clock } from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';

interface SessionStatusBadgeProps {
  onClick?: () => void;
}

export function SessionStatusBadge({ onClick }: SessionStatusBadgeProps) {
  const { isLight, accent } = useTheme();
  const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  // Calculate current session based on UTC+3
  const [sessionInfo, setSessionInfo] = useState<{
    nameAr: string;
    city: string;
    timeStr: string;
    isActive: boolean;
  }>({
    nameAr: 'جلسة التداول',
    city: 'الأسواق العالمية',
    timeStr: '--:--',
    isActive: true,
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // UTC+3 (Riyadh / Mecca / Moscow)
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const utc3 = new Date(utc + 3600000 * 3);
      const hours = utc3.getHours();
      const minutes = utc3.getMinutes();
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} (UTC+3)`;

      let nameAr = 'السيولة الآسيوية';
      let city = 'طوكيو / هونغ كونغ';
      if (hours >= 10 && hours < 16) {
        nameAr = 'السيولة الأوروبية';
        city = 'لندن / فرانكفورت';
      } else if (hours >= 16 && hours < 23) {
        nameAr = 'السيولة الأمريكية';
        city = 'نيويورك (ذروة النشاط)';
      } else if (hours >= 23 || hours < 3) {
        nameAr = 'إغلاق نيويورك / المحيط الهادئ';
        city = 'سيدني / ولينغتون';
      }

      setSessionInfo({
        nameAr,
        city,
        timeStr,
        isActive: true,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      suppressHydrationWarning
      className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition-all hover:scale-[1.02] cursor-pointer"
      style={{
        backgroundColor: palette.badgeBg,
        borderColor: palette.badgeBorder,
        color: isLight ? '#0f172a' : '#f8fafc',
      }}
      title={`الجلسة النشطة: ${sessionInfo.nameAr} - ${sessionInfo.city}`}
    >
      <Globe className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '24s', color: palette.primaryColor }} />
      <span className="font-semibold text-[11px]" style={{ color: palette.primaryColor }}>
        {sessionInfo.nameAr}
      </span>
      <span suppressHydrationWarning className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
        {sessionInfo.timeStr}
      </span>
    </button>
  );
}
