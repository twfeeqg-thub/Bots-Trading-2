'use client';

import React, { useState } from 'react';
import { 
  Radar, 
  LineChart, 
  Bot, 
  ArrowLeftRight, 
  TrendingUp, 
  ShieldCheck, 
  Activity, 
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SessionStatusBadge } from '@/components/markets/SessionStatusBadge';
import { useTheme } from '@/components/theme/ThemeContext';
import { ScannerView } from '@/components/scanner/ScannerView';
import { ChartsView } from '@/components/charts/ChartsView';
import { TradeManagementView } from '@/components/trades/TradeManagementView';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { GlobalMarketsView } from '@/components/markets/GlobalMarketsView';
import { AssistantFloatingButton } from '@/components/assistant/AssistantFloatingButton';
import { AssistantModal } from '@/components/assistant/AssistantModal';

export default function HomePage() {
  const { isLight } = useTheme();
  const [activeTab, setActiveTab] = useState<'scanner' | 'charts' | 'bots' | 'execution' | 'pnl' | 'markets'>('scanner');
  const [selectedAssetForChart, setSelectedAssetForChart] = useState<string | null>(null);
  const [selectedAssetForTrade, setSelectedAssetForTrade] = useState<{ symbol: string; price?: number } | null>(null);
  const [isPipelineExpanded, setIsPipelineExpanded] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);

  const handleAssetSelect = (symbol: string) => {
    setSelectedAssetForChart(symbol);
    setActiveTab('charts');
  };

  const handleAssetTradeSelect = (symbol: string, currentPrice?: number) => {
    setSelectedAssetForTrade({ symbol, price: currentPrice });
    setActiveTab('execution');
  };

  return (
    <div
      id="project-q-root"
      suppressHydrationWarning
      className={`flex flex-col min-h-screen transition-colors duration-200 ${
        isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Top Header */}
      <header
        id="main-header"
        suppressHydrationWarning
        className={`sticky top-0 z-40 border-b backdrop-blur-md px-4 py-3 sm:px-6 transition-colors duration-200 ${
          isLight
            ? 'border-slate-200 bg-white/95 text-slate-900 shadow-xs'
            : 'border-slate-800 bg-slate-900/90 text-slate-100'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
              isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <Radar className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`font-semibold text-base sm:text-lg tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-slate-100'
                }`}>
                  بوت(٢) مراقبة صعود العملات
                </h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  مشروع Q
                </span>
              </div>
              <p className={`text-xs hidden sm:block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                تطبيق بوتات مراقبة العملات وإجراء الصفقات — شاشة البوتات وطبقة التداول V1
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop Navigation Tabs */}
            <div className={`hidden md:flex items-center gap-1 p-1 rounded-lg border text-xs ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('scanner')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'scanner'
                    ? isLight
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>Scanner (نشط)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('charts')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'charts'
                    ? isLight
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Charts (نشط)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('execution')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'execution' || activeTab === 'bots'
                    ? isLight
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>دورة التداول الموحدة (الصفقات والبوتات)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pnl')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'pnl'
                    ? isLight
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>PnL &amp; Analytics</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('markets')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === 'markets'
                    ? isLight
                      ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>الأسواق والسيولة</span>
              </button>
            </div>

            {/* Live Session Status Badge */}
            <SessionStatusBadge onClick={() => setActiveTab('markets')} />

            <div className={`hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-md border text-xs ${
              isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-medium">مدير الصفقة مُفعل</span>
            </div>

            {/* Dark Mode / Light Mode Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-24 md:pb-8">
        {/* Collapsible Architecture Pipeline Banner */}
        <section id="project-flow-banner" className={`rounded-xl border p-4 shadow-xs transition-colors ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                مشروع Q — التدفق العام: Market Data → Scanner → Alert → Execution → Real P/L
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPipelineExpanded(!isPipelineExpanded)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${
                isLight ? 'bg-slate-100 text-slate-600 hover:text-slate-900' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{isPipelineExpanded ? 'طي الخريطة' : 'عرض الخريطة والمبادئ المغلقة'}</span>
              {isPipelineExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {isPipelineExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-mono block">01</span>
                  <span className="text-slate-200 font-medium">Market Data</span>
                  <span className="text-[10px] text-slate-500 block">!miniTicker@arr</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/40">
                  <span className="text-emerald-400 font-mono block">02 [المرحلة 1]</span>
                  <span className="text-emerald-200 font-medium">Scanner</span>
                  <span className="text-[10px] text-emerald-400 block">رصد الصعود</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/40">
                  <span className="text-emerald-400 font-mono block">03 [المرحلة 2]</span>
                  <span className="text-emerald-200 font-medium">Basic Chart</span>
                  <span className="text-[10px] text-emerald-400 block">شارت تفاعلي</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-mono block">04</span>
                  <span className="text-slate-200 font-medium">Execution</span>
                  <span className="text-[10px] text-slate-500 block">Spot &amp; Convert</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-mono block">05</span>
                  <span className="text-slate-200 font-medium">Verification</span>
                  <span className="text-[10px] text-slate-500 block">الحقيقة التنفيذية</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-mono block">06</span>
                  <span className="text-slate-200 font-medium">Position</span>
                  <span className="text-[10px] text-slate-500 block">متابعة وإغلاق</span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 font-mono block">07</span>
                  <span className="text-slate-200 font-medium">Real P/L</span>
                  <span className="text-[10px] text-slate-500 block">صافي بعد الرسوم</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Freshness Timeout: 30 ثانية مغلقة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Central Snapshot: كل ≈ 10 ثوانٍ للبيانات الحية</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Rolling History: تخزين مستمر ≥ 24 ساعة</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Global Sessions: جلسات السيولة واكتشاف السعر (UTC+3)</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Tab Content Display */}
        {activeTab === 'scanner' ? (
          <section id="scanner-main-section">
            <ScannerView
              onSelectAssetForChart={handleAssetSelect}
              onSelectAssetForTrade={handleAssetTradeSelect}
            />
          </section>
        ) : activeTab === 'charts' ? (
          <section id="charts-main-section">
            <ChartsView
              initialSymbol={selectedAssetForChart}
              onBackToScanner={() => setActiveTab('scanner')}
            />
          </section>
        ) : activeTab === 'bots' || activeTab === 'execution' ? (
          <section id="trades-main-section">
            <TradeManagementView
              initialSymbol={selectedAssetForTrade?.symbol}
              initialPrice={selectedAssetForTrade?.price}
            />
          </section>
        ) : activeTab === 'pnl' ? (
          <section id="analytics-main-section">
            <AnalyticsView />
          </section>
        ) : (
          <section id="markets-main-section">
            <GlobalMarketsView
              onNavigateToScanner={() => setActiveTab('scanner')}
              onNavigateToCharts={() => setActiveTab('charts')}
              onNavigateToBots={() => setActiveTab('execution')}
            />
          </section>
        )}
      </main>

      {/* Fixed Bottom Navigation (Mobile-First compliant as specified in Section 9) */}
      <nav id="bottom-navigation" className={`fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t px-2 py-1.5 md:hidden transition-colors ${
        isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800'
      }`}>
        <div className="grid grid-cols-5 gap-0.5">
          <button
            id="nav-tab-scanner"
            type="button"
            onClick={() => setActiveTab('scanner')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'scanner' 
                ? isLight ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-emerald-400 bg-emerald-500/10'
                : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radar className="w-4.5 h-4.5 mb-0.5" />
            <span>الموجّه</span>
          </button>

          <button
            id="nav-tab-charts"
            type="button"
            onClick={() => setActiveTab('charts')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'charts' 
                ? isLight ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-emerald-400 bg-emerald-500/10'
                : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LineChart className="w-4.5 h-4.5 mb-0.5" />
            <span>الشارت</span>
          </button>

          <button
            id="nav-tab-execution"
            type="button"
            onClick={() => setActiveTab('execution')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'execution' || activeTab === 'bots'
                ? isLight ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-emerald-400 bg-emerald-500/10'
                : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4.5 h-4.5 mb-0.5" />
            <span>التداول الموحد</span>
          </button>

          <button
            id="nav-tab-pnl"
            type="button"
            onClick={() => setActiveTab('pnl')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'pnl' 
                ? isLight ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-emerald-400 bg-emerald-500/10'
                : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4.5 h-4.5 mb-0.5" />
            <span>الأرباح</span>
          </button>

          <button
            id="nav-tab-markets"
            type="button"
            onClick={() => setActiveTab('markets')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'markets' 
                ? isLight ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-emerald-400 bg-emerald-500/10'
                : isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-4.5 h-4.5 mb-0.5" />
            <span>الأسواق</span>
          </button>
        </div>
      </nav>

      {/* Floating Smart Assistant Trigger */}
      <AssistantFloatingButton
        isOpen={isAssistantOpen}
        onClick={() => setIsAssistantOpen(!isAssistantOpen)}
      />

      {/* Independent Smart Assistant Modal */}
      <AssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentChartSymbol={selectedAssetForChart}
      />
    </div>
  );
}
