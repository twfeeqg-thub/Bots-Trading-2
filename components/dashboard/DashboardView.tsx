'use client';

// Project Q — Phase: Unified Dashboard View (لوحة التحكم الرئيسية)
// Core Ecosystem: «بوت(٢) مراقبة صعود العملات»
// Pipeline: Market Data → Scanner → Alert → Execution → Real P/L
// Strict Compliance:
// - 30s Freshness Timeout (CLOSED DECISION)
// - 10s Central Snapshot (CLOSED DECISION)
// - 11 Deterministic Bot States (CLOSED DECISION)
// - Mock Transport Mode: 0 real keys, safe simulation

import React, { useState, useEffect } from 'react';
import {
  Radar,
  LineChart,
  TrendingUp,
  Activity,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  Clock,
  Sparkles,
  Server,
  Layers,
  ChevronLeft,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';
import { DEFAULT_EXECUTABLE_UNIVERSE } from '@/lib/scanner/universe';

interface DashboardViewProps {
  onNavigateToScanner: () => void;
  onNavigateToCharts: (symbol?: string) => void;
  onNavigateToTrades: (symbol?: string, price?: number) => void;
}

export function DashboardView({
  onNavigateToScanner,
  onNavigateToCharts,
  onNavigateToTrades,
}: DashboardViewProps) {
  const { isLight, accent } = useTheme();
  const currentPalette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  // Key system metrics
  const [monitoredCount] = useState<number>(DEFAULT_EXECUTABLE_UNIVERSE.length);
  const [activeBotsCount, setActiveBotsCount] = useState<number>(3);
  const [recentSignals, setRecentSignals] = useState<Array<{ symbol: string; change: number; price: number }>>([
    { symbol: 'BTCUSDT', change: 2.45, price: 67420.5 },
    { symbol: 'ETHUSDT', change: 3.12, price: 3495.2 },
    { symbol: 'SOLUSDT', change: 5.68, price: 178.4 },
    { symbol: 'BNBUSDT', change: 1.82, price: 585.6 },
  ]);

  // Load real bot count if available
  useEffect(() => {
    let isMounted = true;
    async function fetchBotSummary() {
      try {
        const res = await fetch('/api/engine/bots');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.bots && Array.isArray(data.bots)) {
            setActiveBotsCount(data.bots.length);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
    fetchBotSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div id="dashboard-view-root" className="space-y-6">
      {/* Hero Welcome / Ecosystem Summary */}
      <div
        className="rounded-2xl border p-5 sm:p-6 backdrop-blur-md relative overflow-hidden shadow-lg transition-colors"
        style={{
          backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
          borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border mb-1"
              style={{
                backgroundColor: currentPalette.badgeBg,
                borderColor: currentPalette.badgeBorder,
                color: currentPalette.primaryColor,
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>مشروع Q — محرك الرصد والتنفيذ الحتمي</span>
            </div>
            <h2
              className="text-xl sm:text-2xl font-black tracking-tight"
              style={{
                color: isLight ? currentPalette.headingColorLight : currentPalette.headingColorDark,
              }}
            >
              بوت(٢) مراقبة صعود العملات
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              منظومة متكاملة وواحدة لرصد الزخم الصاعد، تحليل الشموع، إدارة البوتات وفق 11 حالة حتمية،
              وحساب الأرباح الفعلية الصافية بعد الرسوم.
            </p>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onNavigateToScanner}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer hover:opacity-90 active:scale-95"
              style={{
                backgroundColor: currentPalette.primaryColor,
                color: '#09090b',
              }}
            >
              <Radar className="w-4 h-4" />
              <span>فحص الزخم الفوري (Scanner)</span>
              <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateToTrades()}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-all cursor-pointer hover:bg-slate-800/40 active:scale-95"
              style={{
                borderColor: currentPalette.badgeBorder,
                color: isLight ? '#0f172a' : '#f8fafc',
              }}
            >
              <TrendingUp className="w-4 h-4" style={{ color: currentPalette.primaryColor }} />
              <span>شاشة التداول الموحد</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div
          className="absolute -left-20 -bottom-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: currentPalette.primaryColor }}
        />
      </div>

      {/* 4 Pillars Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Scanner */}
        <div
          onClick={onNavigateToScanner}
          className="rounded-xl border p-4.5 transition-all hover:scale-[1.01] cursor-pointer group shadow-xs"
          style={{
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
            borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: currentPalette.badgeBg,
                borderColor: currentPalette.badgeBorder,
                color: currentPalette.primaryColor,
              }}
            >
              <Radar className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              نشط (Active)
            </span>
          </div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">نطاق المراقبة (Universe)</h3>
          <p className="text-2xl font-black mt-1 text-slate-900 dark:text-slate-100">
            {monitoredCount} <span className="text-xs font-normal text-slate-500">زوج USDT</span>
          </p>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/40 pt-2">
            <span>تحديث كل 10 ثوانٍ</span>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 2: Interactive Chart */}
        <div
          onClick={() => onNavigateToCharts('BTCUSDT')}
          className="rounded-xl border p-4.5 transition-all hover:scale-[1.01] cursor-pointer group shadow-xs"
          style={{
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
            borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: currentPalette.badgeBg,
                borderColor: currentPalette.badgeBorder,
                color: currentPalette.primaryColor,
              }}
            >
              <LineChart className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Interactive
            </span>
          </div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">الشارت الفني والتاريخي</h3>
          <p className="text-2xl font-black mt-1 text-slate-900 dark:text-slate-100">
            24h+ <span className="text-xs font-normal text-slate-500">سجل مستمر</span>
          </p>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/40 pt-2">
            <span>دعم الفترات 1m إلى 1d</span>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 3: Deterministic Bots */}
        <div
          onClick={() => onNavigateToTrades()}
          className="rounded-xl border p-4.5 transition-all hover:scale-[1.01] cursor-pointer group shadow-xs"
          style={{
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
            borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: currentPalette.badgeBg,
                borderColor: currentPalette.badgeBorder,
                color: currentPalette.primaryColor,
              }}
            >
              <Layers className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              11 حالة حتمية
            </span>
          </div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">البوتات المشغّلة</h3>
          <p className="text-2xl font-black mt-1 text-slate-900 dark:text-slate-100">
            {activeBotsCount} <span className="text-xs font-normal text-slate-500">بوتات نموذجية</span>
          </p>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/40 pt-2">
            <span>آلة حالات منضبطة</span>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 group-hover:-translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 4: Safe Mock Execution */}
        <div
          className="rounded-xl border p-4.5 shadow-xs"
          style={{
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
            borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center border"
              style={{
                backgroundColor: currentPalette.badgeBg,
                borderColor: currentPalette.badgeBorder,
                color: currentPalette.primaryColor,
              }}
            >
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Safe Mock
            </span>
          </div>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">وضع المحاكاة والأمان</h3>
          <p className="text-2xl font-black mt-1 text-emerald-400">
            100% <span className="text-xs font-normal text-slate-500">حماية من المخاطر</span>
          </p>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/40 pt-2">
            <span>لا مفاتيح سرية مكشوفة</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Real-time Momentum Highlights & Pipeline Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Momentum Highlights (2 cols) */}
        <div
          className="lg:col-span-2 rounded-2xl border p-5 backdrop-blur-md shadow-xs space-y-4"
          style={{
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
            borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                أبرز العملات الصاعدة حالياً (Momentum Leaders)
              </h3>
            </div>
            <button
              type="button"
              onClick={onNavigateToScanner}
              className="text-xs flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
            >
              <span>عرض كل الموجّه</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentSignals.map((item) => (
              <div
                key={item.symbol}
                className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <span className="font-bold font-mono text-sm text-slate-200 block">
                    {item.symbol}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    ${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold font-mono flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    +{item.change}%
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToCharts(item.symbol)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                    title="عرض الشارت"
                  >
                    <LineChart className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToTrades(item.symbol, item.price)}
                    className="p-1.5 rounded-lg bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600/50 cursor-pointer"
                    title="فتح صفقة"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Closed Decisions & Architecture Guardrails (1 col) */}
        <div
          className="rounded-2xl border p-5 backdrop-blur-md shadow-xs space-y-4"
          style={{
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
            borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
          }}
        >
          <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              الضوابط والقرارات المغلقة
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">مهلة الحداثة (Freshness Timeout)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  30 ثانية مغلقة كحد أقصى لحداثة بيانات الأسعار قبل اعتبار السعر قديماً.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">اللقطة المركزية (Central Snapshot)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  تحديث موحد كل ≈ 10 ثوانٍ يغذي الموجّه، الشارت، والبوتات بالتزامن.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">11 حالة حتمية للبوتات</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  انتقالات حتمية وموثقة تدعم الإلغاء والتعليق والتحقق الصارم من الأوامر.
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">التنفيذ الآمن (Mock Transport)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  محاكاة مطابقة لبينانس بدون الحاجة لأي مفاتيح حقيقية في هذه المرحلة.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
