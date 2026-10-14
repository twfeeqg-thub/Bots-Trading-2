'use client';

import React, { useState, useEffect } from 'react';
import { Download, Share2, PlusSquare, X, Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import { useTheme } from '@/components/theme/ThemeContext';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export function PWAInstallButton({ className = '', variant = 'compact' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { isLight } = useTheme();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    const success = await install();
    if (success) {
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 3000);
    }
  };

  // If not on iOS and not yet installable by browser prompt, we still show the option on mobile browsers
  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="تثبيت التطبيق على جهازك (PWA)"
        title="تثبيت التطبيق على الشاشة الرئيسية (PWA)"
        className={`group relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 ${
          isLight
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 hover:bg-amber-500/20'
            : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
        } ${className}`}
      >
        {justInstalled ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">تم التثبيت!</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
            <span className="font-medium">
              {variant === 'full' ? 'تثبيت التطبيق (PWA)' : 'تثبيت PWA'}
            </span>
          </>
        )}
      </button>

      {/* iOS Safari Instruction Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl relative ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 left-4 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/50"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">تثبيت التطبيق على iPhone / iPad</h3>
                <p className="text-xs text-slate-400">يعمل كـ تطبيق أصلي دون شريط المتصفح</p>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed border-y py-3.5 my-2 border-slate-800/80">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400 shrink-0 text-[10px]">1</div>
                <div>
                  اضغط على أيقونة <span className="font-semibold text-amber-400 inline-flex items-center gap-1 mx-1"><Share2 className="w-3.5 h-3.5" /> المشاركة (Share)</span> في شريط Safari بالأسفل.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400 shrink-0 text-[10px]">2</div>
                <div>
                  مرر للأسفل واضغط على <span className="font-semibold text-amber-400 inline-flex items-center gap-1 mx-1"><PlusSquare className="w-3.5 h-3.5" /> «إضافة إلى الشاشة الرئيسية»</span> (Add to Home Screen).
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-emerald-400 shrink-0 text-[10px]">3</div>
                <div>
                  اضغط «إضافة» (Add) في أعلى الشاشة وستظهر أيقونة التطبيق على شاشتك فوراً!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full mt-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors"
            >
              فهمت ذلك، إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function PWAFlowBanner() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { isLight } = useTheme();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem('project_q_pwa_dismissed') === 'true';
    } catch {
      return true;
    }
  });
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('project_q_pwa_dismissed', 'true');
    } catch {}
  };

  const handleAction = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    const success = await install();
    if (success) {
      handleDismiss();
    }
  };

  return (
    <>
      <aside
        aria-label="تثبيت التطبيق على الشاشة الرئيسية"
        className={`fixed bottom-18 md:bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 rounded-2xl border p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5 ${
          isLight
            ? 'bg-white/95 border-amber-300/80 text-slate-900 shadow-amber-900/10'
            : 'bg-slate-900/95 border-amber-500/40 text-slate-100 shadow-amber-500/10'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs sm:text-sm">تثبيت التطبيق (PWA)</h4>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/20 text-amber-500 border border-amber-500/40">
                  سريع ومستقل
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                ثبّت التطبيق على هاتفك أو سطح المكتب لتجربة سريعة وتنبيهات لحظية.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="إغلاق التنبيه"
            className="text-slate-400 hover:text-slate-200 p-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleAction}
            className="flex-1 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تثبيت الآن مجاناً</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
              isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            لاحقاً
          </button>
        </div>
      </aside>

      {/* iOS Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl relative ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 left-4 p-1 rounded-lg text-slate-400 hover:text-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-sm mb-2 text-amber-400">التثبيت على Safari (iOS)</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              1. اضغط على أيقونة المشاركة في شريط Safari.<br />
              2. اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>.<br />
              3. اضغط «إضافة».
            </p>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              تم
            </button>
          </div>
        </div>
      )}
    </>
  );
}
