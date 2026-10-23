'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe, 
  Clock, 
  Layers, 
  Sparkles, 
  ArrowRight 
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';
import { SessionTimelineCard } from './SessionTimelineCard';
import { 
  MARKET_SESSIONS, 
  OVERLAP_WINDOWS, 
  getCurrentTimeUtc3, 
  calculateSessionStatus, 
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
    <div id="global-markets-container" className="space-y-6 pb-12 animate-in fade-in duration-200 max-w-full overflow-hidden">
      {/* Top Banner / Header Bar */}
      <div className={`rounded-2xl p-4 sm:p-6 border shadow-sm transition-all theme-section ${
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
              <h2 className="theme-heading text-lg sm:text-xl font-bold tracking-tight">
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
      {/* MODULE 1: 24h Visual Timeline & Clocks (Reused Component) */}
      {/* ------------------------------------------------------------- */}
      <SessionTimelineCard />

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
