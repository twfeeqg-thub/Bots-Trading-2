'use client';

import React from 'react';
import { 
  Palette, 
  X, 
  Sun, 
  Moon, 
  Monitor, 
  Check, 
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useTheme, ACCENT_PALETTES, type AccentColor, type ThemeModePreference } from './ThemeContext';

interface ThemeCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeCustomizerModal({ isOpen, onClose }: ThemeCustomizerModalProps) {
  const { 
    modePreference, 
    setModePreference, 
    accent, 
    setAccent, 
    isLight,
    theme 
  } = useTheme();

  if (!isOpen) return null;

  const modeOptions: { id: ThemeModePreference; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      id: 'system',
      label: 'تلقائي حسب النظام',
      sublabel: 'يتغير تلقائياً مع إعدادات جهازك',
      icon: <Monitor className="w-5 h-5" />,
    },
    {
      id: 'dark',
      label: 'داكن مريح للعين',
      sublabel: 'الوضع الداكن الموصى به للتداول الليلي',
      icon: <Moon className="w-5 h-5" />,
    },
    {
      id: 'light',
      label: 'فاتح عالي التباين',
      sublabel: 'إضاءة واضحة ومتباينة للشاشات النهارية',
      icon: <Sun className="w-5 h-5" />,
    },
  ];

  const currentPalette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-modal-title"
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 animate-in zoom-in-95 ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isLight ? 'border-slate-100 bg-slate-50/70' : 'border-slate-800/80 bg-slate-950/40'
        }`}>
          <div className="flex items-center gap-2.5">
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs transition-colors duration-200"
              style={{
                backgroundColor: currentPalette.primaryColor,
                color: '#09090b',
              }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 id="theme-modal-title" className="font-bold text-base sm:text-lg">
                تخصيص مظهر التطبيق وألوان الثيم
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                اختر وضع الإضاءة واللون الأساسي المميز للتطبيق
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Mode Preference */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              وضع الإضاءة العام
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {modeOptions.map((opt) => {
                const isSelected = modePreference === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setModePreference(opt.id)}
                    className={`flex flex-col items-start p-3.5 rounded-xl border text-right transition-all cursor-pointer relative ${
                      isSelected
                        ? isLight
                          ? 'border-slate-900 bg-slate-100/90 shadow-xs ring-2 ring-slate-900/10'
                          : 'border-white bg-slate-800/90 shadow-md ring-2 ring-white/10'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className={`p-2 rounded-lg ${
                        isSelected 
                          ? isLight ? 'bg-slate-900 text-white' : 'bg-white text-slate-950'
                          : isLight ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {opt.icon}
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-3" />
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-xs">{opt.label}</span>
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
                بطاقات الألوان المخصصة (مع المعاينة الحية الفورية)
              </label>
              <span className="text-[11px] text-emerald-500 flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3" />
                تطبيق فوري وتلقائي
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(ACCENT_PALETTES) as AccentColor[]).map((paletteKey) => {
                const pal = ACCENT_PALETTES[paletteKey];
                const isSelected = accent === paletteKey;

                return (
                  <button
                    key={pal.id}
                    type="button"
                    onClick={() => setAccent(pal.id)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-right transition-all cursor-pointer relative ${
                      isSelected
                        ? 'ring-2 shadow-md'
                        : isLight
                        ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                    style={{
                      borderColor: isSelected ? pal.primaryColor : undefined,
                      boxShadow: isSelected ? `0 0 16px ${pal.badgeBg}` : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Color Circle Preview */}
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm shrink-0 transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: pal.primaryColor,
                          boxShadow: `0 2px 8px ${pal.primaryColor}40`,
                        }}
                      >
                        <span>{pal.emoji}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm">
                            {pal.nameAr}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block font-mono">
                          {pal.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Color swatch dot */}
                      <div 
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: pal.primaryColor }}
                      />
                      {isSelected ? (
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-slate-950 shadow-xs"
                          style={{ backgroundColor: pal.primaryColor }}
                        >
                          <Check className="w-4 h-4 stroke-3" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-700" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Live Preview Test Strip */}
          <div className={`p-4 rounded-xl border ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}>
            <span className="text-[11px] font-bold text-slate-400 block mb-2">
              معاينة حية للمظهر على عناصر الواجهة:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span 
                className="px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-xs"
                style={{
                  backgroundColor: currentPalette.primaryColor,
                  color: '#09090b',
                }}
              >
                زر إجراء رئيسي
              </span>

              <span 
                className="px-2.5 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 transition-all"
                style={{
                  backgroundColor: currentPalette.badgeBg,
                  borderColor: currentPalette.badgeBorder,
                  color: currentPalette.primaryColor,
                }}
              >
                <Zap className="w-3 h-3" />
                شارة نشطة
              </span>

              <span 
                className="px-2.5 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 transition-all"
                style={{
                  backgroundColor: currentPalette.badgeBg,
                  borderColor: currentPalette.badgeBorder,
                  color: currentPalette.primaryColor,
                }}
              >
                <TrendingUp className="w-3 h-3" />
                تبويب محدد
              </span>

              <span className={`text-xs px-2 py-0.5 rounded border ${
                isLight ? 'bg-white border-slate-300 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                الوضع النشط: {theme === 'light' ? 'فاتح' : 'مظلم'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3.5 border-t ${
          isLight ? 'border-slate-100 bg-slate-50' : 'border-slate-800/80 bg-slate-950/60'
        }`}>
          <div className="text-xs text-slate-400">
            يتم حفظ التفضيلات تلقائياً في المتصفح (localStorage)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            style={{
              backgroundColor: currentPalette.primaryColor,
              color: '#09090b',
            }}
          >
            تم واعتمد المظهر
          </button>
        </div>
      </div>
    </div>
  );
}
