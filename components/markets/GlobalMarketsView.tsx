'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, 
  Clock, 
  Flame, 
  Landmark, 
  TrendingUp, 
  Building2, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Zap,
  Info,
  Calendar,
  Sparkles,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';
import { 
  MARKET_SESSIONS, 
  OVERLAP_WINDOWS, 
  getCurrentTimeUtc3, 
  calculateSessionStatus, 
  getCmeStatus, 
  formatMinutesAr,
  MarketSession
} from '@/lib/markets/sessions';

interface GlobalMarketsViewProps {
  onNavigateToScanner?: () => void;
  onNavigateToCharts?: () => void;
  onNavigateToBots?: () => void;
}

export function GlobalMarketsView({
  onNavigateToScanner,
  onNavigateToCharts,
  onNavigateToBots
}: GlobalMarketsViewProps) {
  const { isLight } = useTheme();

  // Live timer tick every second
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const utc3 = useMemo(() => getCurrentTimeUtc3(now), [now]);

  // Status for each session
  const sessionStatuses = useMemo(() => {
    return MARKET_SESSIONS.map((session) => 
      calculateSessionStatus(session, utc3.totalMinutesOfDay)
    );
  }, [utc3.totalMinutesOfDay]);

  // CME Status
  const cmeStatus = useMemo(() => getCmeStatus(utc3), [utc3]);

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
    <div id="global-markets-container" className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner / Header Bar */}
      <div className={`rounded-2xl p-4 sm:p-6 border shadow-sm transition-all ${
        isLight 
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-emerald-200 text-slate-800' 
          : 'bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 border-slate-800 text-slate-100'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className={`p-2 rounded-xl border flex items-center justify-center ${
                isLight ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                <Globe className="w-5 h-5 animate-spin-slow" />
              </div>
              <h2 className={`text-lg sm:text-xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                الأسواق والسيولة العالمية (Global Markets &amp; Sessions)
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isLight ? 'bg-white text-emerald-800 border-emerald-300 shadow-xs' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
              }`}>
                توقيت اليمن والسعودية (UTC+3)
              </span>
            </div>
            <p className={`text-xs sm:text-sm max-w-3xl leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              تحليل دورات السيولة العالمية الأربع، وفترات التداخل الذهبية، ومثلث اكتشاف السعر المؤسساتي (CME &amp; Binance Perps &amp; Spot) لضبط توقيت الصفقات ورصد أفضل فترات الزخم الصاعد.
            </p>
          </div>

          {/* Quick Stat Pill */}
          <div className={`px-4 py-3 rounded-xl border shadow-xs flex items-center gap-3 shrink-0 ${
            isLight ? 'bg-white border-emerald-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <Clock className={`w-5 h-5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <div>
              <div className="text-[10px] text-slate-500 font-medium">الوقت اللحظي المعتمد</div>
              <div className="font-mono text-base font-bold text-emerald-500">
                {utc3.formattedTime}
              </div>
              <div className="text-[10px] text-slate-400">
                {utc3.formattedDate}
              </div>
            </div>
          </div>
        </div>

        {/* Current Phase Highlight Box */}
        <div className={`mt-4 p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          currentPhaseTitle.isPeak
            ? isLight
              ? 'bg-amber-100/70 border-amber-300 text-amber-950'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
            : isLight
            ? 'bg-white/80 border-slate-200 text-slate-800'
            : 'bg-slate-950/60 border-slate-800 text-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="text-xl">
              {currentPhaseTitle.isPeak ? '🔥' : '🌐'}
            </span>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                <span>{currentPhaseTitle.title}</span>
                {openSessions.length > 0 && (
                  <span className={`text-[10px] px-2 py-0.2 rounded-full border ${
                    isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30'
                  }`}>
                    {openSessions.length} جلسات مفتوحة حالياً
                  </span>
                )}
              </div>
              <div className="text-xs opacity-90">{currentPhaseTitle.desc}</div>
            </div>
          </div>

          {/* Quick shortcuts to other tabs */}
          <div className="flex items-center gap-2 shrink-0">
            {onNavigateToScanner && (
              <button
                type="button"
                onClick={onNavigateToScanner}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1 shadow-xs"
              >
                <span>رادار الصعود</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {onNavigateToCharts && (
              <button
                type="button"
                onClick={onNavigateToCharts}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  isLight 
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <span>الشارتات</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODULE 1: 24h Visual Timeline & Clocks */}
      {/* ------------------------------------------------------------- */}
      <section className={`rounded-2xl p-4 sm:p-6 border shadow-sm space-y-5 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3 border-slate-800/40">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" />
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                شريط التقدم الزمني للـ 24 ساعة (Session Timeline)
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                توزيع فترات التداول الأربع ونوافذ التداخل الذهبية على مدار اليوم
              </p>
            </div>
          </div>

          {/* Major World Clocks Pill Row */}
          <div className="flex items-center flex-wrap gap-2 text-xs font-mono">
            <div className={`px-2.5 py-1 rounded-lg border ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <span className="text-[10px] text-slate-500 ml-1.5 font-sans">صنعاء/الرياض:</span>
              <strong className="text-emerald-500">{utc3.hours.toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
            </div>
            <div className={`px-2.5 py-1 rounded-lg border ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <span className="text-[10px] text-slate-500 ml-1.5 font-sans">لندن (UTC+1):</span>
              <strong>{((utc3.hours - 2 + 24) % 24).toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
            </div>
            <div className={`px-2.5 py-1 rounded-lg border ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <span className="text-[10px] text-slate-500 ml-1.5 font-sans">نيويورك (UTC-4):</span>
              <strong>{((utc3.hours - 7 + 24) % 24).toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
            </div>
            <div className={`px-2.5 py-1 rounded-lg border ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <span className="text-[10px] text-slate-500 ml-1.5 font-sans">طوكيو (UTC+9):</span>
              <strong>{((utc3.hours + 6) % 24).toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')}</strong>
            </div>
          </div>
        </div>

        {/* 24-Hour Visual Bar Component */}
        <div className="space-y-2 pt-2">
          {/* Time markers (00:00 to 24:00) */}
          <div className="flex justify-between text-[10px] font-mono text-slate-400 px-1">
            <span>00:00</span>
            <span>03:00 (آسيا)</span>
            <span>06:00</span>
            <span>10:00 (تداخل 1)</span>
            <span>11:00 (لندن)</span>
            <span>16:00 (تداخل 2)</span>
            <span>20:00</span>
            <span>24:00</span>
          </div>

          {/* Interactive Bar Track */}
          <div className={`relative h-12 rounded-xl overflow-hidden border p-1 flex items-center ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            {/* Session Segments on Timeline */}
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
              🇯🇵 طوكيو (نطاق آسيا)
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
              className="absolute h-8 inset-y-2 rounded-lg bg-amber-500/20 border-2 border-amber-400/80 pointer-events-none flex items-center justify-center text-[10px] font-bold text-amber-500 z-10 animate-pulse"
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
          <div className="flex flex-wrap items-center justify-between text-xs pt-1 text-slate-500">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="font-semibold text-slate-300">أنت هنا الآن ({utc3.hours.toString().padStart(2, '0')}:{utc3.minutes.toString().padStart(2, '0')})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>النافذة الذهبية (تداخل لندن ونيويورك 4م - 8م)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>فترة الهدوء الآسيوية وسيدني (2ص - 6ص)</span>
              </span>
            </div>

            <div className="text-[11px] font-mono">
              دورة اليوم: {Math.round(timelineNeedlePercent)}% منقضي
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* MODULE 2: The 4 Market Sessions Cards Grid */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500" />
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              جلسات التداول العالمية الأربع
            </h3>
          </div>
          <span className="text-xs text-slate-500">مواعيد الافتتاح والإغلاق بتوقيت صنعاء ومكة (UTC+3)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sessionStatuses.map(({ session, isOpen, progressPercent, timeUntilOpenMin, timeUntilCloseMin }) => (
            <div
              key={session.id}
              className={`rounded-2xl border p-4.5 transition-all flex flex-col justify-between space-y-4 shadow-sm relative overflow-hidden ${
                isOpen
                  ? isLight
                    ? 'bg-white border-emerald-300 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-slate-900/90 border-emerald-500/40 ring-1 ring-emerald-500/30'
                  : isLight
                  ? 'bg-slate-50/70 border-slate-200 opacity-90'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-80'
              }`}
            >
              {/* Active top glow indicator */}
              {isOpen && (
                <div 
                  className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" 
                />
              )}

              {/* Card Header: Flag, Name, Status Badge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{session.flag}</span>
                    <div>
                      <h4 className={`font-bold text-sm leading-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        {session.nameAr}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">{session.nameEn}</span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${
                    isOpen
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 animate-pulse'
                      : 'bg-slate-800/50 text-slate-400 border-slate-700/60'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    <span>{isOpen ? 'نشطة الآن' : 'مغلقة'}</span>
                  </span>
                </div>

                {/* Timing Badge */}
                <div className={`p-2 rounded-lg border flex items-center justify-between text-xs font-mono ${
                  isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-slate-950 border-slate-800'
                }`}>
                  <span className="text-[11px] text-slate-400 font-sans">التوقيت:</span>
                  <span className="font-bold text-slate-200">
                    {session.startHourUtc3.toString().padStart(2, '0')}:00 — {session.endHourUtc3.toString().padStart(2, '0')}:00
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">({session.durationHours} س)</span>
                </div>
              </div>

              {/* Progress & Countdown Area */}
              <div className="space-y-2 pt-1 border-t border-slate-800/40">
                {isOpen ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">الوقت المنقضي:</span>
                      <span className="font-mono text-emerald-400 font-bold">{progressPercent}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div 
                        style={{ width: `${progressPercent}%` }}
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-0.5 font-mono">
                      <span>متبقي للإغلاق:</span>
                      <strong className="text-amber-400">{formatMinutesAr(timeUntilCloseMin)}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-xs py-1">
                    <span className="text-slate-400">الافتتاح القادم بعد:</span>
                    <strong className="font-mono text-slate-200 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700">
                      {formatMinutesAr(timeUntilOpenMin)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Liquidity Level & Behavior summary */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/40 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">تصنيف السيولة:</span>
                  <span className={`px-2 py-0.2 rounded font-semibold ${
                    session.liquidityLevel === 'peak'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : session.liquidityLevel === 'high'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : session.liquidityLevel === 'medium'
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {session.liquidityLabelAr}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2" title={session.tradingBehaviorAr}>
                  {session.tradingBehaviorAr}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* MODULE 3: Price Discovery Matrix (Perpetual Futures, CME, Spot) */}
      {/* ------------------------------------------------------------- */}
      <section className={`rounded-2xl p-4 sm:p-6 border shadow-sm space-y-5 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex items-center gap-2 border-b pb-3 border-slate-800/40">
          <Landmark className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              مثلث اكتشاف السعر (Price Discovery Triad) — من أين يتحرك سعر البيتكوين حقاً؟
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              التحليل الهيكلي لتدفق السيولة بين العقود الدائمة، والمؤسسات المنظمة (CME)، وبورصات التداول الفوري
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Perpetual Futures Card */}
          <div className={`rounded-xl border p-4 space-y-3 ${
            isLight ? 'bg-amber-50/60 border-amber-200' : 'bg-amber-950/20 border-amber-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                1. المحرك القائد (The Engine)
              </span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              العقود الدائمة (Perpetual Futures)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              الآلية الأقوى لاكتشاف الأسعار اللحظية؛ تشكل <strong className="text-amber-400">93%</strong> من إجمالي حجم تداول المشتقات للبيتكوين، حيث تدخل المعلومات الجديدة هنا أولاً لتشكل السعر.
            </p>
            <div className={`p-2.5 rounded-lg border text-xs space-y-1.5 font-mono ${
              isLight ? 'bg-white border-amber-200 text-slate-800' : 'bg-slate-950 border-amber-500/20 text-slate-200'
            }`}>
              <div className="flex justify-between">
                <span>اللاعب المهيمن:</span>
                <strong className="text-amber-400">Binance (33% - 40%)</strong>
              </div>
              <div className="flex justify-between">
                <span>كبار المنافسين:</span>
                <span>Bybit (~15%) &amp; OKX</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-sans">
                <span>الدور التداولي:</span>
                <span className="text-emerald-400">يقود الاختراقات اللحظية</span>
              </div>
            </div>
          </div>

          {/* 2. CME Regulated Futures Card */}
          <div className={`rounded-xl border p-4 space-y-3 ${
            isLight ? 'bg-blue-50/60 border-blue-200' : 'bg-blue-950/20 border-blue-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                2. ثقل المؤسسات (Institutions)
              </span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              مجموعة شيكاغو التجارية (CME Group)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              السوق المنظم الأبرز للبنوك الكبرى وصناديق الـ ETF؛ تقود أنشطة التحوط (Hedging) وإدارة المخاطر بعيدة المدى، وتعمل بنظام 24/7.
            </p>
            <div className={`p-2.5 rounded-lg border text-xs space-y-1.5 font-mono ${
              isLight ? 'bg-white border-blue-200 text-slate-800' : 'bg-slate-950 border-blue-500/20 text-slate-200'
            }`}>
              <div className="flex justify-between">
                <span>حالة CME اللحظية:</span>
                <strong className={cmeStatus.isMaintenance ? 'text-rose-400' : 'text-emerald-400'}>
                  {cmeStatus.isMaintenance ? 'توقف صيانة مؤقت' : 'نشط مستمر 24/7'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>نافذة الصيانة:</span>
                <span>فجر الاثنين (1:00 ص - 2:00 ص)</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-sans">
                <span>الدور المؤسساتي:</span>
                <span className="text-blue-400">تثبيت الاتجاه العام والتحوط</span>
              </div>
            </div>
          </div>

          {/* 3. Spot Exchanges Card */}
          <div className={`rounded-xl border p-4 space-y-3 ${
            isLight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                3. مرساة السيولة (The Anchor)
              </span>
              <BarChart3 className="w-4 h-4 text-emerald-400" />
            </div>
            <h4 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              بورصات التداول الفوري (Spot Exchanges)
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              أسواق الشراء والبيع الفعلي بنقل الملكية؛ تمثل الأساس المرجعي لسعر التسوية الذي تقاس عليه كافة المشتقات المالية وصناديق التداول.
            </p>
            <div className={`p-2.5 rounded-lg border text-xs space-y-1.5 font-mono ${
              isLight ? 'bg-white border-emerald-200 text-slate-800' : 'bg-slate-950 border-emerald-500/20 text-slate-200'
            }`}>
              <div className="flex justify-between">
                <span>حجم Binance Spot:</span>
                <strong className="text-emerald-400">≈ $7.5 مليار يومياً</strong>
              </div>
              <div className="flex justify-between">
                <span>مؤشر أمريكا:</span>
                <span>Coinbase (مؤشر المؤسسات)</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-sans">
                <span>الدور الفوري:</span>
                <span className="text-emerald-400">مرساة السعر النهائي والسيولة</span>
              </div>
            </div>
          </div>
        </div>

        {/* CME Maintenance Warning Banner */}
        <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
          cmeStatus.isMaintenance
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            : cmeStatus.isUpcomingSoon
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            : isLight
            ? 'bg-slate-50 border-slate-200 text-slate-700'
            : 'bg-slate-950/60 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-2">
            {cmeStatus.isMaintenance ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span><strong>حالة CME Group:</strong> {cmeStatus.messageAr}</span>
          </div>

          <span className="font-mono text-[11px] text-slate-400 hidden sm:inline">
            الأحد 22:00 UTC = الاثنين 01:00 بتوقيت صنعاء/مكة
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* MODULE 4: Tactical Trading Playbook by Session */}
      {/* ------------------------------------------------------------- */}
      <section className={`rounded-2xl p-4 sm:p-6 border shadow-sm space-y-4 transition-colors ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex items-center gap-2 border-b pb-3 border-slate-800/40">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              دليل التداول اللحظي للجلسات (Session Trading Playbook)
            </h3>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              توصيات عملية لاستغلال طبيعة الجلسات في ضبط إعدادات بوتات مشروع Q ورصد الصعود
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Guide 1: The 02:00 - 06:00 AM Calm */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <span className="text-base">🌙</span>
              <span>تفسير هدوء وتراجع الأسعار ليلاً (02:00 ص - 06:00 ص بتوقيت اليمن):</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              هذه الفترة تتزامن مع انفراد جلسة سيدني الضعيفة مع بداية جلسة طوكيو المنعزلة؛ بدون وجود سيولة أوروبية أو أمريكية، تضيق حركة السوق ويميل السعر للتجميع السلبي أو التراجع البطيء. 
            </p>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px] text-emerald-400">
              💡 <strong>نصيحة للبوتات:</strong> تجنب تشغيل أوامر الشراء المفرطة في هذه الساعات؛ انتظر تحديد قاع الجلسة الآسيوية لاستغلاله كمنطقة ارتداد قوية مع افتتاح لندن.
            </div>
          </div>

          {/* Guide 2: London Open & NY Overlap */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}>
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <span className="text-base">🚀</span>
              <span>الانفجارات السعرية الكبرى (11:00 ص و 04:00 م - 08:00 م):</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              عند دخول لندن (11:00 ص)، تقوم البنوك باختبار قمة أو قاع آسيا، ثم تصل السيولة لذروتها المطلقة في تداخل لندن بنيويورك (04:00 - 08:00 م)، حيث تتطابق السيولة الفورية والعقود الدائمة.
            </p>
            <div className="p-2 rounded bg-slate-900/60 border border-slate-800 text-[11px] text-amber-400">
              🔥 <strong>نصيحة للبوتات:</strong> هذه هي النافذة الذهبية لبوتات الزخم الصاعد (Momentum Bots) وصفقات الـ Breakout، لأن الاختراقات فيها تكون مدعومة بأحجام حقيقية وليست مصائد وهمية.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
