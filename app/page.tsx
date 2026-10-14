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
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { PWAInstallButton } from '@/components/pwa/PWAInstallPrompt';
import { SessionStatusBadge } from '@/components/markets/SessionStatusBadge';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';
import { ScannerView } from '@/components/scanner/ScannerView';
import { ChartsView } from '@/components/charts/ChartsView';
import { TradeManagementView } from '@/components/trades/TradeManagementView';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { GlobalMarketsView } from '@/components/markets/GlobalMarketsView';
import { AssistantFloatingButton } from '@/components/assistant/AssistantFloatingButton';
import { AssistantModal } from '@/components/assistant/AssistantModal';

export default function HomePage() {
  const { isLight, accent } = useTheme();
  const currentPalette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;
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
      className="flex flex-col min-h-screen transition-colors duration-200 bg-transparent text-slate-900 dark:text-slate-100 max-w-full overflow-x-hidden"
    >
      {/* Top Header */}
      <header
        id="main-header"
        suppressHydrationWarning
        className="theme-section sticky top-0 z-40 border-b backdrop-blur-md px-2 sm:px-6 py-2 sm:py-3 transition-colors duration-200 max-w-full shadow-xs"
        style={{
          backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
          borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Brand & Identity */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div 
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all duration-300 shadow-xs shrink-0"
              style={{
                backgroundColor: currentPalette.badgeBg,
                borderColor: currentPalette.badgeBorder,
                color: currentPalette.primaryColor,
              }}
            >
              <Radar className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1
                  className="theme-heading font-bold text-xs sm:text-base md:text-lg tracking-tight truncate"
                  style={{
                    color: isLight ? currentPalette.headingColorLight : currentPalette.headingColorDark,
                  }}
                >
                  <span className="sm:hidden">بوت(٢) الصعود</span>
                  <span className="hidden sm:inline">بوت(٢) مراقبة صعود العملات</span>
                </h1>
                <span 
                  className="text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-semibold border transition-all duration-200 shrink-0"
                  style={{
                    backgroundColor: currentPalette.badgeBg,
                    borderColor: currentPalette.badgeBorder,
                    color: currentPalette.primaryColor,
                  }}
                >
                  مشروع Q
                </span>
              </div>
              <p className={`text-[11px] hidden lg:block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                تطبيق بوتات مراقبة العملات وإجراء الصفقات — شاشة البوتات وطبقة التداول V1
              </p>
            </div>
          </div>

          {/* Center / Navigation Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Desktop Navigation Tabs */}
            <div className={`hidden md:flex items-center gap-1 p-1 rounded-xl border text-xs ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('scanner')}
                style={{
                  backgroundColor: activeTab === 'scanner' ? currentPalette.primaryColor : undefined,
                  color: activeTab === 'scanner' ? (isLight ? '#09090b' : '#09090b') : undefined,
                  borderColor: activeTab === 'scanner' ? currentPalette.primaryColor : undefined,
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'scanner'
                    ? 'shadow-xs scale-[1.02]'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Radar className="w-3.5 h-3.5" />
                <span>Scanner (نشط)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('charts')}
                style={{
                  backgroundColor: activeTab === 'charts' ? currentPalette.primaryColor : undefined,
                  color: activeTab === 'charts' ? '#09090b' : undefined,
                  borderColor: activeTab === 'charts' ? currentPalette.primaryColor : undefined,
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'charts'
                    ? 'shadow-xs scale-[1.02]'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>Charts (نشط)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('execution')}
                style={{
                  backgroundColor: activeTab === 'execution' || activeTab === 'bots' ? currentPalette.primaryColor : undefined,
                  color: activeTab === 'execution' || activeTab === 'bots' ? '#09090b' : undefined,
                  borderColor: activeTab === 'execution' || activeTab === 'bots' ? currentPalette.primaryColor : undefined,
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'execution' || activeTab === 'bots'
                    ? 'shadow-xs scale-[1.02]'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>دورة التداول الموحدة (الصفقات والبوتات)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pnl')}
                style={{
                  backgroundColor: activeTab === 'pnl' ? currentPalette.primaryColor : undefined,
                  color: activeTab === 'pnl' ? '#09090b' : undefined,
                  borderColor: activeTab === 'pnl' ? currentPalette.primaryColor : undefined,
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'pnl'
                    ? 'shadow-xs scale-[1.02]'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>PnL &amp; Analytics</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('markets')}
                style={{
                  backgroundColor: activeTab === 'markets' ? currentPalette.primaryColor : undefined,
                  color: activeTab === 'markets' ? '#09090b' : undefined,
                  borderColor: activeTab === 'markets' ? currentPalette.primaryColor : undefined,
                }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'markets'
                    ? 'shadow-xs scale-[1.02]'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>الأسواق والسيولة</span>
              </button>
            </div>

            {/* Live Session Status Badge */}
            <SessionStatusBadge onClick={() => setActiveTab('markets')} />

            {/* Active Position Manager Status Pill */}
            <div 
              className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs transition-colors"
              style={{
                backgroundColor: currentPalette.badgeBg,
                borderColor: currentPalette.badgeBorder,
                color: currentPalette.primaryColor,
              }}
            >
              <span 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: currentPalette.primaryColor }}
              />
              <span className="font-semibold">مدير الصفقة مُفعل</span>
            </div>

            {/* In-App PWA Install Button */}
            <PWAInstallButton />

            {/* Permanent & Prominent Theme Palette Button */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-6 space-y-5 sm:space-y-6 pb-24 md:pb-8 overflow-x-hidden min-w-0">
        {/* Collapsible Architecture Pipeline Banner */}
        <section
          id="project-flow-banner"
          className="theme-section rounded-2xl border p-3.5 sm:p-4 shadow-md backdrop-blur-md transition-colors"
          style={{
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
            borderColor: isLight ? currentPalette.sectionBorderLight : currentPalette.sectionBorderDark,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Activity 
                className="w-4 h-4 transition-colors shrink-0" 
                style={{ color: currentPalette.primaryColor }} 
              />
              <span
                className="theme-heading text-xs font-semibold truncate"
                style={{
                  color: isLight ? currentPalette.headingColorLight : currentPalette.headingColorDark,
                }}
              >
                مشروع Q — التدفق العام: Market Data → Scanner → Alert → Execution → Real P/L
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsPipelineExpanded(!isPipelineExpanded)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
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
                <div 
                  className="p-2 rounded border"
                  style={{
                    backgroundColor: currentPalette.badgeBg,
                    borderColor: currentPalette.badgeBorder,
                  }}
                >
                  <span 
                    className="font-mono block"
                    style={{ color: currentPalette.primaryColor }}
                  >
                    02 [المرحلة 1]
                  </span>
                  <span className="font-semibold block" style={{ color: currentPalette.primaryColor }}>Scanner</span>
                  <span className="text-[10px] block opacity-80" style={{ color: currentPalette.primaryColor }}>رصد الصعود</span>
                </div>
                <div 
                  className="p-2 rounded border"
                  style={{
                    backgroundColor: currentPalette.badgeBg,
                    borderColor: currentPalette.badgeBorder,
                  }}
                >
                  <span 
                    className="font-mono block"
                    style={{ color: currentPalette.primaryColor }}
                  >
                    03 [المرحلة 2]
                  </span>
                  <span className="font-semibold block" style={{ color: currentPalette.primaryColor }}>Basic Chart</span>
                  <span className="text-[10px] block opacity-80" style={{ color: currentPalette.primaryColor }}>شارت تفاعلي</span>
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

        {/* Tab Content Display with Framer Motion subtle fade and slide up */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Fixed Bottom Navigation (Mobile-First compliant as specified in Section 9) */}
      <nav id="bottom-navigation" className={`theme-section fixed bottom-0 left-0 right-0 z-50 backdrop-blur-md border-t px-2 py-1.5 md:hidden transition-colors ${
        isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800'
      }`}>
        <div className="grid grid-cols-5 gap-0.5">
          <button
            id="nav-tab-scanner"
            type="button"
            onClick={() => setActiveTab('scanner')}
            style={{
              color: activeTab === 'scanner' ? currentPalette.primaryColor : undefined,
              backgroundColor: activeTab === 'scanner' ? currentPalette.badgeBg : undefined,
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-medium transition-colors ${
              activeTab === 'scanner' 
                ? 'font-bold'
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
            style={{
              color: activeTab === 'charts' ? currentPalette.primaryColor : undefined,
              backgroundColor: activeTab === 'charts' ? currentPalette.badgeBg : undefined,
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-medium transition-colors ${
              activeTab === 'charts' 
                ? 'font-bold'
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
            style={{
              color: (activeTab === 'execution' || activeTab === 'bots') ? currentPalette.primaryColor : undefined,
              backgroundColor: (activeTab === 'execution' || activeTab === 'bots') ? currentPalette.badgeBg : undefined,
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-medium transition-colors ${
              activeTab === 'execution' || activeTab === 'bots'
                ? 'font-bold'
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
            style={{
              color: activeTab === 'pnl' ? currentPalette.primaryColor : undefined,
              backgroundColor: activeTab === 'pnl' ? currentPalette.badgeBg : undefined,
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-medium transition-colors ${
              activeTab === 'pnl' 
                ? 'font-bold'
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
            style={{
              color: activeTab === 'markets' ? currentPalette.primaryColor : undefined,
              backgroundColor: activeTab === 'markets' ? currentPalette.badgeBg : undefined,
            }}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] font-medium transition-colors ${
              activeTab === 'markets' 
                ? 'font-bold'
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
