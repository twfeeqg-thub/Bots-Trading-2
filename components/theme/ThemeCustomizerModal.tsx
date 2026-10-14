'use client';

import React from 'react';
import {
  Palette,
  X,
  Sun,
  Moon,
  Laptop,
  Check,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  useTheme,
  ACCENT_PALETTES,
  type AccentColor,
  type ThemeModePreference,
} from './ThemeContext';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeCustomizerModal({ isOpen, onClose }: ThemeCustomizerModalProps) {
  const {
    themeMode,
    setThemeMode,
    accent,
    setAccentColor,
    isLight,
    theme,
  } = useTheme();

  if (!isOpen) return null;

  const modeOptions: {
    id: ThemeModePreference;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'system',
      label: 'تلقائي حسب نظام جهازك',
      sublabel: 'يتكيف لحظياً وبدقة مع إعدادات نظام التشغيل',
      icon: <Laptop className="w-5 h-5" />,
    },
    {
      id: 'dark',
      label: 'داكن مريح للعين',
      sublabel: 'الوضع الليلي الاحترافي لتقليل إجهاد النظر',
      icon: <Moon className="w-5 h-5" />,
    },
    {
      id: 'light',
      label: 'فاتح عالي التباين',
      sublabel: 'إضاءة واضحة ومتباينة للشاشات النهارية الساطعة',
      icon: <Sun className="w-5 h-5" />,
    },
  ];

  const palettesList: ('amber' | 'emerald' | 'cyan' | 'violet')[] = [
    'amber',
    'emerald',
    'cyan',
    'violet',
  ];

  const currentPalette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.amber;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md overflow-hidden animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
        className={`theme-modal-dialog w-full max-w-xl max-h-[90dvh] sm:max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 animate-in zoom-in-95 backdrop-blur-xl ${
          isLight
            ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-300/50'
            : 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-black/80'
        }`}
        style={{
          backgroundColor: isLight ? currentPalette.cardBgLight : currentPalette.cardBgDark,
          borderColor: isLight ? currentPalette.cardBorderLight : currentPalette.cardBorderDark,
          boxShadow: `0 20px 50px rgba(0, 0, 0, 0.6), 0 0 35px ${currentPalette.badgeBg}`,
        }}
      >
        {/* Modal Header (Fixed / Shrink-0) */}
        <div
          className="theme-modal-header shrink-0 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b transition-colors"
          style={{
            borderColor: isLight ? currentPalette.cardBorderLight : currentPalette.cardBorderDark,
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-xs transition-colors duration-200 shrink-0"
              style={{
                backgroundColor: currentPalette.primaryColor,
                color: '#09090b',
              }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="theme-modal-title"
                className="theme-heading font-bold text-sm sm:text-lg tracking-tight"
                style={{
                  color: isLight ? currentPalette.headingColorLight : currentPalette.headingColorDark,
                }}
              >
                تخصيص مظهر التطبيق وألوان الثيم
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Global Theme &amp; Ambient Workspace System
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable with flex-1 min-h-0) */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5 overscroll-contain">
          {/* Section 1: Mode Preference */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                1. وضع الإضاءة العام
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                النشط: {theme === 'light' ? 'فاتح' : 'داكن'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {modeOptions.map((opt) => {
                const isSelected = themeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setThemeMode(opt.id)}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-right transition-all cursor-pointer relative ${
                      isSelected
                        ? `ring-2 ring-amber-500/40 border-amber-500/60 shadow-md ${
                            isLight ? 'bg-slate-100/90' : 'bg-slate-800/90'
                          }`
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div
                        className={`p-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : isLight
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {opt.icon}
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5 stroke-3" />
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-xs sm:text-sm">{opt.label}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {opt.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Accent Palette Cards */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                2. بطاقات الألوان المخصصة (مع المعاينة الحية الفورية)
              </label>
              <span className="text-[11px] text-amber-500 flex items-center gap-1 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                تغيير شامل وفوري
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {palettesList.map((paletteKey) => {
                const pal = ACCENT_PALETTES[paletteKey];
                const isSelected = accent === paletteKey;

                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => setAccentColor(pal.id)}
                    className={`group flex items-start justify-between p-3.5 rounded-xl border text-right transition-all cursor-pointer relative ${
                      isSelected
                        ? 'ring-2 ring-amber-500/40 border-amber-500/70 shadow-lg'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                    style={{
                      boxShadow: isSelected
                        ? `0 4px 20px ${pal.primaryColor}25`
                        : undefined,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Color Circle with ring */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-105 relative"
                        style={{
                          backgroundColor: pal.primaryColor,
                          boxShadow: `0 2px 10px ${pal.primaryColor}50`,
                        }}
                      >
                        <span className="text-sm select-none">{pal.emoji}</span>
                        {/* Outer luxury ring */}
                        <span
                          className={`absolute -inset-1 rounded-full border-2 ${
                            isSelected
                              ? 'border-white dark:border-slate-100 opacity-90'
                              : 'border-transparent'
                          }`}
                        />
                      </div>

                      <div className="flex-1 pr-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm">
                            {pal.nameAr}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {pal.name}
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {pal.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 mt-0.5">
                      {isSelected ? (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shadow-xs"
                          style={{
                            backgroundColor: pal.primaryColor,
                            color: '#09090b',
                          }}
                        >
                          <Check className="w-3.5 h-3.5 stroke-3" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Live Preview Test Strip */}
          <div
            className={`p-4 rounded-xl border transition-colors ${
              isLight
                ? 'bg-slate-50/90 border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                معاينة حية للمظهر على مكونات المنصة:
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                ACTIVE_PALETTE: {currentPalette.name}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Primary Action Button Preview */}
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-amber-500/20 bg-amber-500 text-slate-950 flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                زر إجراء رئيسي
              </button>

              {/* Active Tab Preview */}
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-500 flex items-center gap-1.5 shadow-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                تبويب محدد
              </div>

              {/* Status Badge Preview */}
              <div className="px-2.5 py-1 rounded-md text-xs font-medium border border-amber-500/40 bg-amber-500/15 text-amber-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                شارة أمان نشطة
              </div>

              {/* Mode indicator */}
              <span
                className={`text-[11px] px-2.5 py-1 rounded-md border ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                الوضع: {theme === 'light' ? 'فاتح' : 'داكن'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer (Fixed / Shrink-0) */}
        <div
          className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t transition-colors"
          style={{
            borderColor: isLight ? currentPalette.cardBorderLight : currentPalette.cardBorderDark,
            backgroundColor: isLight ? currentPalette.sectionBgLight : currentPalette.sectionBgDark,
          }}
        >
          <div className="text-[11px] text-slate-400 text-center sm:text-right">
            يتم تطبيق وحفظ كافة التفضيلات تلقائياً في المتصفح وتنعكس فورياً على كامل الشاشات.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer text-center"
            style={{
              backgroundColor: currentPalette.primaryColor,
              color: '#09090b',
              boxShadow: `0 4px 14px ${currentPalette.badgeBg}`,
            }}
          >
            إغلاق وتطبيق المظهر
          </button>
        </div>
      </div>
    </div>
  );
}
