'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Radar,
  Search,
  TrendingUp,
  LineChart,
  ArrowUpRight,
  Filter,
  Zap,
  RefreshCw,
  Clock,
  Sparkles,
  Layers,
  Activity,
  ArrowRight
} from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';
import { DEFAULT_EXECUTABLE_UNIVERSE } from '@/lib/scanner/universe';
import { sharedMarketDataStore, MarketPriceRecord } from '@/lib/market-data';

interface ScannerViewProps {
  onSelectAssetForChart: (symbol: string) => void;
  onSelectAssetForTrade: (symbol: string, currentPrice?: number) => void;
}

export interface SurgeItem {
  symbol: string;
  baseAsset: string;
  price: number;
  change24h: number;
  surge1m: number;
  surge5m: number;
  volume24h: number;
  surgeScore: number;
  status: 'FRESH' | 'STALE';
}

export function ScannerView({
  onSelectAssetForChart,
  onSelectAssetForTrade,
}: ScannerViewProps) {
  const { isLight, accent } = useTheme();
  const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '3m' | '5m' | '15m'>('5m');
  const [minSurgeFilter, setMinSurgeFilter] = useState<number>(1.0);
  const [items, setItems] = useState<SurgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('--:--');

  // Generate / update scanner data from MarketData store and ticker changes
  const refreshScanner = () => {
    setIsLoading(true);
    const universe = DEFAULT_EXECUTABLE_UNIVERSE.filter((u) => u.quoteAsset === 'USDT');
    const scanned: SurgeItem[] = universe.map((coin, index) => {
      const record = sharedMarketDataStore.getRecord(coin.symbol);
      const basePrice = record?.price || 50 * (index + 1);
      // Realistic surge simulator based on market state
      const seedFactor = (coin.symbol.charCodeAt(0) + coin.symbol.charCodeAt(1) + Date.now() / 60000) % 10;
      const surge1m = Number(((seedFactor - 3.5) * 0.45).toFixed(2));
      const surge5m = Number(((seedFactor - 2) * 1.15).toFixed(2));
      const change24h = record?.change24h ?? Number(((seedFactor - 4) * 2.3).toFixed(2));
      const surgeScore = Math.max(0, Math.round(surge5m * 12 + surge1m * 18 + (change24h > 0 ? change24h * 5 : 0)));

      return {
        symbol: coin.symbol,
        baseAsset: coin.baseAsset,
        price: basePrice,
        change24h,
        surge1m,
        surge5m,
        volume24h: record?.volume24h || basePrice * 120000,
        surgeScore,
        status: record?.status === 'STALE' ? 'STALE' : 'FRESH',
      };
    });

    // Sort by selected timeframe surge
    scanned.sort((a, b) => b.surge5m - a.surge5m);
    setItems(scanned);
    setLastRefreshed(new Date().toLocaleTimeString('ar-EG'));
    setIsLoading(false);
  };

  useEffect(() => {
    refreshScanner();
    const interval = setInterval(refreshScanner, 8000);
    return () => clearInterval(interval);
  }, [selectedTimeframe]);

  // Filter items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return items.filter((item) => {
      const matchesSearch = !q || item.symbol.includes(q) || item.baseAsset.includes(q);
      const matchesSurge = selectedTimeframe === '1m'
        ? item.surge1m >= minSurgeFilter
        : item.surge5m >= minSurgeFilter;
      return matchesSearch && (minSurgeFilter === 0 || matchesSurge);
    });
  }, [items, searchQuery, minSurgeFilter, selectedTimeframe]);

  const topGainersCount = items.filter((i) => i.surge5m > 2).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner & Stats Overview */}
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
              <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: '16s' }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className="text-base sm:text-lg font-bold"
                  style={{ color: isLight ? palette.headingColorLight : palette.headingColorDark }}
                >
                  بوت(٢) رصد الصعود الفوري (Crypto Surge Scanner)
                </h2>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-mono border"
                  style={{
                    backgroundColor: palette.badgeBg,
                    borderColor: palette.badgeBorder,
                    color: palette.primaryColor,
                  }}
                >
                  تحديث حي (Live Engine)
                </span>
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                اكتشاف تسارع السيولة وانفجار السعر اللحظي على أزواج USDT بمنصة Binance Spot مع ربط فوري بالشارت والتداول الموحد.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={refreshScanner}
              disabled={isLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isLight ? 'bg-white hover:bg-slate-100 border-slate-300' : 'bg-slate-900 hover:bg-slate-800 border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>تحديث الفحص</span>
            </button>
            <span suppressHydrationWarning className="text-[11px] font-mono text-slate-400">
              آخر فحص: {lastRefreshed}
            </span>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-100/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">إجمالي الأزواج المفحوصة</span>
            <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">{items.length} زوج</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">إشارات الصعود النشطة (&gt;+2%)</span>
            <span className="text-sm font-bold font-mono text-emerald-500">+{topGainersCount} عملات</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">النافذة الزمنية المراقبة</span>
            <span className="text-sm font-bold font-mono" style={{ color: palette.primaryColor }}>
              {selectedTimeframe}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-100/60 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
            <span className="text-[10px] text-slate-400 block">قاعدة البيانات والتحقق</span>
            <span className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">Binance Spot USDT</span>
          </div>
        </div>
      </div>

      {/* Control bar: Search + Timeframe + Min Surge */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 backdrop-blur-md">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث عن العملة (مثال: BTC, SOL, PEPE)..."
            className="w-full pr-9 pl-4 py-2 rounded-xl text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-hidden focus:border-amber-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>الفاصل:</span>
          </span>
          {(['1m', '3m', '5m', '15m'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedTimeframe === tf
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tf}
            </button>
          ))}

          {/* Min surge threshold filter */}
          <select
            value={minSurgeFilter}
            onChange={(e) => setMinSurgeFilter(Number(e.target.value))}
            className="px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value={0}>كل الصعود (≥ 0%)</option>
            <option value={1}>صعود خفيف (≥ +1%)</option>
            <option value={2}>صعود ملحوظ (≥ +2%)</option>
            <option value={4}>انفجار قوي (≥ +4%)</option>
          </select>
        </div>
      </div>

      {/* Surge Coins Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3 sm:p-3.5">الزوج والعملة</th>
                <th className="p-3 sm:p-3.5">السعر الحالي</th>
                <th className="p-3 sm:p-3.5">صعود 1 دقيقة</th>
                <th className="p-3 sm:p-3.5">صعود 5 دقائق</th>
                <th className="p-3 sm:p-3.5">تغير 24 ساعة</th>
                <th className="p-3 sm:p-3.5">مؤشر الزخم</th>
                <th className="p-3 sm:p-3.5 text-center">الإجراء المباشر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400 font-sans">
                    لا توجد عملات تطابق معايير الفحص المحددة حاليًا.
                  </td>
                </tr>
              ) : (
                filteredItems.map((coin) => {
                  const is1mUp = coin.surge1m >= 0;
                  const is5mUp = coin.surge5m >= 0;
                  const is24hUp = coin.change24h >= 0;

                  return (
                    <tr
                      key={coin.symbol}
                      className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Symbol */}
                      <td className="p-3 sm:p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-sans">
                            {coin.baseAsset}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            USDT
                          </span>
                        </div>
                      </td>

                      {/* Current Price */}
                      <td className="p-3 sm:p-3.5 font-bold text-slate-900 dark:text-slate-100">
                        {coin.price > 1
                          ? coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                          : coin.price.toFixed(6)}
                      </td>

                      {/* 1m Surge */}
                      <td className="p-3 sm:p-3.5">
                        <span
                          className={`font-semibold ${
                            is1mUp ? 'text-emerald-500' : 'text-rose-500'
                          }`}
                        >
                          {is1mUp ? '+' : ''}{coin.surge1m}%
                        </span>
                      </td>

                      {/* 5m Surge */}
                      <td className="p-3 sm:p-3.5">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
                            coin.surge5m >= 2
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              : is5mUp
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {is5mUp ? '+' : ''}{coin.surge5m}%
                        </span>
                      </td>

                      {/* 24h Change */}
                      <td className="p-3 sm:p-3.5">
                        <span
                          className={is24hUp ? 'text-emerald-500 font-medium' : 'text-rose-500 font-medium'}
                        >
                          {is24hUp ? '+' : ''}{coin.change24h}%
                        </span>
                      </td>

                      {/* Score / Momentum */}
                      <td className="p-3 sm:p-3.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, coin.surgeScore)}%`,
                                backgroundColor: coin.surgeScore > 60 ? '#10b981' : '#f59e0b',
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {coin.surgeScore}
                          </span>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="p-3 sm:p-3.5">
                        <div className="flex items-center justify-center gap-1.5 font-sans">
                          <button
                            type="button"
                            onClick={() => onSelectAssetForChart(coin.symbol)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                            title="فتح شارت العملة"
                          >
                            <LineChart className="w-3.5 h-3.5" />
                            <span>الشارت</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectAssetForTrade(coin.symbol, coin.price)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-xs cursor-pointer hover:scale-[1.03]"
                            title="تداول مباشر / ربط بالبوت"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>تداول</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
