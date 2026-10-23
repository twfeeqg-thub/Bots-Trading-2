'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';
import { 
  MARKET_SESSIONS, 
  OVERLAP_WINDOWS, 
  getCurrentTimeUtc3, 
  calculateSessionStatus,
} from '@/lib/markets/sessions';

interface SessionTimelineCardProps {
  compact?: boolean;
}

export function SessionTimelineCard({ compact = false }: SessionTimelineCardProps) {
  const { isLight } = useTheme();
  const [mounted, setMounted] = useState<boolean>(false);

  // Live timer tick every second
  const [now, setNow] = useState<Date>(() => new Date(0));

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const utc3 = useMemo(() => getCurrentTimeUtc3(mounted ? now : new Date(0)), [now, mounted]);

  // Status for each session
  const sessionStatuses = useMemo(() => {
    return MARKET_SESSIONS.map((session) => 
      calculateSessionStatus(session, utc3.totalMinutesOfDay)
    );
  }, [utc3.totalMinutesOfDay]);

  // Active Overlaps
  const activeOverlaps = useMemo(() => {
    return OVERLAP_WINDOWS.filter((overlap) => {
      return utc3.hours >= overlap.startHourUtc3 && utc3.hours < overlap.endHourUtc3;
    });
  }, [utc3.hours]);

  // Open sessions count
  const openSessions = useMemo(() => {
    return sessionStatuses.filter((s) => s.isOpen);
  }, [sessionStatuses]);

  // Current market phase summary
  const currentPhaseTitle = useMemo(() => {
    if (activeOverlaps.some((o) => o.id === 'london-newyork')) {
      return {
        title: '🔥 ذروة السيولة العالمية (تداخل لندن + نيويورك)',
        desc: 'أعلى سيولة يومية وأضيق فروقات سعرية؛ أفضل فترة لاختراقات الزخم الصاعد المؤسساتي.',
        isPeak: true,
      };
    }
    if (activeOverlaps.some((o) => o.id === 'tokyo-london')) {
      return {
        title: '⚡ تداخل طوكيو + لندن (بدء التسخين الأوروبي)',
        desc: 'فترة تحول رئيسية تشهد خروج آسيا وبدء أوامر البنوك وصناديق التحوط في لندن.',
        isPeak: false,
      };
    }
    if (openSessions.some((s) => s.session.id === 'newyork')) {
      return {
        title: '🟢 الجلسة الأمريكية نشطة (وول ستريت)',
        desc: 'سيولة وتدفقات أموال الصناديق الاستثمارية وصناديق البيتكوين ETF في الولايات المتحدة.',
        isPeak: false,
      };
    }
    if (openSessions.some((s) => s.session.id === 'london')) {
      return {
        title: '🟢 الجلسة الأوروبية نشطة (لندن)',
        desc: 'سيولة البنوك الأوروبية وتحديد قيعان وقمم اليوم السعري بعد نطاق آسيا.',
        isPeak: false,
      };
    }
    if (openSessions.some((s) => s.session.id === 'tokyo')) {
      return {
        title: '🟡 الجلسة الآسيوية نشطة (طوكيو وشنغهاي)',
        desc: 'سيولة متوسطة ونطاق تجميعي أسيوي؛ عادة ما تتسم الأسعار بالحركة الأفقية والتجميع.',
        isPeak: false,
      };
    }
    return {
      title: '🔵 جلسة سيدني (فترة الهدوء والسيولة الضعيفة)',
      desc: 'أولى ساعات اليوم التداولي؛ هدوء نسبي في السيولة مما يفسر انخفاض وتذبذب الأسعار ليلاً.',
      isPeak: false,
    };
  }, [activeOverlaps, openSessions]);

  // Percentage position of current time needle on 24h timeline
  const timelineNeedlePercent = useMemo(() => {
    return (utc3.totalMinutesOfDay / 1440) * 100;
  }, [utc3.totalMinutesOfDay]);

  return (
    <section 
      suppressHydrationWarning
      className={`theme-section rounded-2xl p-4 sm:p-5 border shadow-xs space-y-4 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      {/* Header and Clocks */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 border-slate-800/40">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <h3 className="theme-heading text-sm sm:text-base font-bold flex items-center gap-2">
              <span>شريط التقدم الزمني للـ 24 ساعة (Session Timeline)</span>
              {openSessions.length > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-normal ${
                  isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                }`}>
                  {openSessions.length} جلسات مفتوحة
                </span>
              )}
            </h3>
            <p className={`text-[11px] sm:text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              توزيع فترات التداول الأربع ونوافذ التداخل الذهبية على مدار اليوم
            </p>
          </div>
        </div>

        {/* Major World Clocks Pill Row */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs font-mono">
          <div className={`px-2 py-1 rounded-lg border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}>
            <span className="text-[10px] text-slate-500 ml-1 font-sans">صنعاء/الرياض:</span>
            <strong className="text-emerald-500">{utc3.hours.toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
          </div>
          <div className={`px-2 py-1 rounded-lg border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}>
            <span className="text-[10px] text-slate-500 ml-1 font-sans">لندن:</span>
            <strong>{((utc3.hours - 2 + 24) % 24).toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
          </div>
          <div className={`px-2 py-1 rounded-lg border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}>
            <span className="text-[10px] text-slate-500 ml-1 font-sans">نيويورك:</span>
            <strong>{((utc3.hours - 7 + 24) % 24).toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
          </div>
          <div className={`px-2 py-1 rounded-lg border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}>
            <span className="text-[10px] text-slate-500 ml-1 font-sans">طوكيو:</span>
            <strong>{((utc3.hours + 6) % 24).toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
          </div>
        </div>
      </div>

      {/* Current Phase Highlight Box */}
      <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
        currentPhaseTitle.isPeak
          ? isLight
            ? 'bg-amber-100/70 border-amber-300 text-amber-950'
            : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
          : isLight
          ? 'bg-slate-50 border-slate-200 text-slate-800'
          : 'bg-slate-950/60 border-slate-800 text-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className="text-lg">
            {currentPhaseTitle.isPeak ? '🔥' : '🌐'}
          </span>
          <div>
            <div className="font-bold text-xs sm:text-sm flex items-center gap-2">
              <span>{currentPhaseTitle.title}</span>
            </div>
            <div className="text-[11px] opacity-85 leading-tight">{currentPhaseTitle.desc}</div>
          </div>
        </div>
      </div>

      {/* 24-Hour Visual Bar Component */}
      <div className="space-y-2 pt-1">
        {/* Time markers (00:00 to 24:00) */}
        <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1">
          <span>00:00</span>
          <span>03:00 (آسيا)</span>
          <span>06:00</span>
          <span>10:00 (تداخل)</span>
          <span>11:00 (لندن)</span>
          <span>16:00 (تداخل 2)</span>
          <span>20:00</span>
          <span>24:00</span>
        </div>

        {/* Interactive Bar Track */}
        <div className={`relative h-11 sm:h-12 rounded-xl overflow-hidden border p-1 flex items-center ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          {/* Sydney: 01:00 to 10:00 (4.16% to 41.6%) */}
          <div 
            style={{ left: `${(1/24)*100}%`, width: `${(9/24)*100}%` }}
            className="absolute h-4 top-1.5 rounded-md bg-sky-500/25 border border-sky-500/40 flex items-center justify-center text-[9px] font-semibold text-sky-400 truncate px-1"
            title="جلسة سيدني (01:00 ص - 10:00 ص)"
          >
            🇦🇺 سيدني
          </div>

          {/* Tokyo: 03:00 to 12:00 (12.5% to 50%) */}
          <div 
            style={{ left: `${(3/24)*100}%`, width: `${(9/24)*100}%` }}
            className="absolute h-4 bottom-1.5 rounded-md bg-violet-500/30 border border-violet-500/40 flex items-center justify-center text-[9px] font-semibold text-violet-400 truncate px-1"
            title="الجلسة الآسيوية / طوكيو (03:00 ص - 12:00 م)"
          >
            🇯🇵 طوكيو
          </div>

          {/* London: 11:00 to 20:00 (45.8% to 83.3%) */}
          <div 
            style={{ left: `${(11/24)*100}%`, width: `${(9/24)*100}%` }}
            className="absolute h-4 top-1.5 rounded-md bg-blue-500/30 border border-blue-500/50 flex items-center justify-center text-[9px] font-semibold text-blue-400 truncate px-1"
            title="الجلسة الأوروبية / لندن (11:00 ص - 08:00 م)"
          >
            🇬🇧 لندن
          </div>

          {/* New York: 16:00 to 24:00 (66.6% to 100%) and 00:00 to 01:00 */}
          <div 
            style={{ left: `${(16/24)*100}%`, width: `${(8/24)*100}%` }}
            className="absolute h-4 bottom-1.5 rounded-md bg-emerald-500/30 border border-emerald-500/50 flex items-center justify-center text-[9px] font-semibold text-emerald-400 truncate px-1"
            title="الجلسة الأمريكية / نيويورك (04:00 م - 01:00 ص)"
          >
            🇺🇸 نيويورك
          </div>
          <div 
            style={{ left: '0%', width: `${(1/24)*100}%` }}
            className="absolute h-4 bottom-1.5 rounded-r-md bg-emerald-500/30 border-r border-emerald-500/50 flex items-center justify-center text-[9px] font-semibold text-emerald-400"
            title="امتداد نيويورك حتى 01:00 ص"
          >
            NY
          </div>

          {/* Golden Overlap Highlight: London + NY (16:00 to 20:00) */}
          <div 
            style={{ left: `${(16/24)*100}%`, width: `${(4/24)*100}%` }}
            className="absolute h-8 inset-y-1.5 rounded-lg bg-amber-500/20 border-2 border-amber-400/80 pointer-events-none flex items-center justify-center text-[10px] font-bold text-amber-500 z-10 animate-pulse"
            title="🔥 تداخل لندن + نيويورك (النافذة الذهبية للسيولة)"
          >
            🔥 الذروة
          </div>

          {/* Current Time Needle */}
          <div 
            style={{ left: `${timelineNeedlePercent}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 shadow-[0_0_8px_rgba(244,63,94,0.9)]"
          >
            <div className="relative -left-2 -top-1 w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md">
              ▼
            </div>
          </div>
        </div>

        {/* Timeline Legend */}
        <div className="flex flex-wrap items-center justify-between text-[11px] pt-1 text-slate-500 gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-semibold text-slate-300">الوقت الآن ({utc3.hours.toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')})</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>النافذة الذهبية (تداخل لندن ونيويورك 4م - 8م)</span>
            </span>
          </div>

          <div className="text-[11px] font-mono">
            اليوم التداولي: {Math.round(timelineNeedlePercent)}% منقضي
          </div>
        </div>
      </div>
    </section>
  );
}
