'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Clock,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  Radar,
  LineChart,
  Bot,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';
import { sharedMarketDataStore } from '@/lib/market-data';

interface GlobalMarketsViewProps {
  onNavigateToScanner?: () => void;
  onNavigateToCharts?: () => void;
  onNavigateToBots?: () => void;
}

interface MarketSession {
  nameAr: string;
  nameEn: string;
  city: string;
  openUtc3: string;
  closeUtc3: string;
  isActive: boolean;
  liquidityLevel: 'عالية جدًا' | 'عالية' | 'متوسطة' | 'هادئة';
  color: string;
}

export function GlobalMarketsView({
  onNavigateToScanner,
  onNavigateToCharts,
  onNavigateToBots,
}: GlobalMarketsViewProps) {
  const { isLight, accent } = useTheme();
  const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  const [currentTimeUtc3, setCurrentTimeUtc3] = useState<string>('--:--:--');
  const [activeSessionCount, setActiveSessionCount] = useState<number>(1);

  // Compute active sessions according to UTC+3 (Mecca / Riyadh / Moscow)
  const [sessions, setSessions] = useState<MarketSession[]>([]);

  useEffect(() => {
    const updateSessions = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const utc3 = new Date(utc + 3600000 * 3);
      const hours = utc3.getHours();
      const minutes = utc3.getMinutes();
      const seconds = utc3.getSeconds();

      setCurrentTimeUtc3(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} (UTC+3)`
      );

      const sessList: MarketSession[] = [
        {
          nameAr: 'جلسة طوكيو / شرق آسيا',
          nameEn: 'Asian Session (Tokyo & HK)',
          city: 'طوكيو / هونغ كونغ',
          openUtc3: '03:00',
          closeUtc3: '11:00',
          isActive: hours >= 3 && hours < 11,
          liquidityLevel: 'متوسطة',
          color: '#06b6d4',
        },
        {
          nameAr: 'جلسة لندن / أوروبا',
          nameEn: 'European Session (London & Frankfurt)',
          city: 'لندن / فرانكفورت',
          openUtc3: '10:00',
          closeUtc3: '18:00',
          isActive: hours >= 10 && hours < 18,
          liquidityLevel: 'عالية',
          color: '#3b82f6',
        },
        {
          nameAr: 'جلسة نيويورك / أمريكا',
          nameEn: 'US Session (New York)',
          city: 'نيويورك (ذروة السيولة العالمية)',
          openUtc3: '15:30',
          closeUtc3: '23:00',
          isActive: hours >= 15 && hours < 23,
          liquidityLevel: 'عالية جدًا',
          color: '#10b981',
        },
        {
          nameAr: 'جلسة سيدني / المحيط الهادئ',
          nameEn: 'Pacific Session (Sydney)',
          city: 'سيدني / ولينغتون',
          openUtc3: '00:00',
          closeUtc3: '08:00',
          isActive: hours >= 0 && hours < 8,
          liquidityLevel: 'هادئة',
          color: '#a855f7',
        },
      ];

      setSessions(sessList);
      setActiveSessionCount(sessList.filter((s) => s.isActive).length);
    };

    updateSessions();
    const interval = setInterval(updateSessions, 1000);
    return () => clearInterval(interval);
  }, []);

  const btcPrice = sharedMarketDataStore.getFreshPrice('BTCUSDT') || 67850;
  const ethPrice = sharedMarketDataStore.getFreshPrice('ETHUSDT') || 2640;
  const solPrice = sharedMarketDataStore.getFreshPrice('SOLUSDT') || 182.5;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className="p-4 sm:p-5 rounded-2xl border transition-colors shadow-md backdrop-blur-md"
        style={{
          backgroundColor: isLight ? palette.sectionBgLight : palette.sectionBgDark,
          borderColor: isLight ? palette.sectionBorderLight : palette.sectionBorderDark,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-xs"
              style={{
                backgroundColor: palette.badgeBg,
                borderColor: palette.badgeBorder,
                color: palette.primaryColor,
              }}
            >
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className="text-base sm:text-lg font-bold"
                  style={{ color: isLight ? palette.headingColorLight : palette.headingColorDark }}
                >
                  الأسواق العالمية وجلسات السيولة وتدفقات الأسعار (UTC+3)
                </h2>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-mono border"
                  style={{
                    backgroundColor: palette.badgeBg,
                    borderColor: palette.badgeBorder,
                    color: palette.primaryColor,
                  }}
                >
                  توقيت مكة والرياض الرسمي
                </span>
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                متابعة تداخل جلسات التداول العالمية، مؤشرات اكتشاف السعر، ومصادر تدفق السيولة للعملات المشفرة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-amber-400 border border-slate-700 flex items-center gap-2 shadow-xs">
              <Clock className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>{currentTimeUtc3}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Market Sessions Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sessions.map((sess) => (
          <div
            key={sess.nameAr}
            className={`p-4 rounded-2xl border transition-all relative overflow-hidden ${
              sess.isActive
                ? 'bg-slate-900/95 border-emerald-500/50 shadow-lg ring-1 ring-emerald-500/30'
                : 'bg-slate-900/60 border-slate-800 opacity-80'
            }`}
          >
            {sess.isActive && (
              <span className="absolute top-3 left-3 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" style={{ color: sess.color }} />
                <span className="font-bold text-sm text-slate-100">{sess.nameAr}</span>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                <span>المراكز: {sess.city}</span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                <span className="text-slate-400">ساعات العمل:</span>
                <span className="font-mono text-slate-200">
                  {sess.openUtc3} - {sess.closeUtc3}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">كثافة السيولة:</span>
                <span className="font-bold text-slate-100 font-mono">{sess.liquidityLevel}</span>
              </div>

              <div className="pt-1">
                <span
                  className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    sess.isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {sess.isActive ? 'الجلسة نشطة الآن' : 'مغلقة حالياً'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Major Liquid Assets Status & Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* BTC */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-100">Bitcoin (BTC / USDT)</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-mono font-bold">
              مؤشر السوق
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            ${btcPrice.toLocaleString()}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            عمق السيولة الأساسي وزعيم حركة السوق.
          </span>
        </div>

        {/* ETH */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-100">Ethereum (ETH / USDT)</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-mono font-bold">
              العقود الذكية
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            ${ethPrice.toLocaleString()}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            محرك العملات البديلة وحجم المعاملات اللامركزية.
          </span>
        </div>

        {/* SOL */}
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 dark:text-slate-100">Solana (SOL / USDT)</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono font-bold">
              السرعة والزخم
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            ${solPrice.toLocaleString()}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 block">
            الموجات السعرية الأسرع استجابة في دورات الصعود.
          </span>
        </div>
      </div>

      {/* Navigation Shortcuts */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            الانتقال السريع لوظائف بوت(٢)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            الانتقال المباشر بين الماسح اللحظي، الشارت التفاعلي، ودورة التداول الموحدة.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateToScanner && (
            <button
              type="button"
              onClick={onNavigateToScanner}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Radar className="w-3.5 h-3.5 text-amber-500" />
              <span>الماسح (Scanner)</span>
            </button>
          )}

          {onNavigateToCharts && (
            <button
              type="button"
              onClick={onNavigateToCharts}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              <LineChart className="w-3.5 h-3.5 text-blue-500" />
              <span>الشارت (Charts)</span>
            </button>
          )}

          {onNavigateToBots && (
            <button
              type="button"
              onClick={onNavigateToBots}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer transition-all shadow-xs"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>التداول الموحد والبوتات</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
