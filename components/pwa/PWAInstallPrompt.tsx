'use client';

import React, { useState, useEffect } from 'react';
import { Download, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { useTheme, ACCENT_PALETTES } from '@/components/theme/ThemeContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallButton() {
  const { isLight, accent } = useTheme();
  const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.gold;
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // In mobile Safari or unsupported browsers, show informative prompt
      alert('لتثبيت التطبيق على جهازك: اضغط على زر المشاركة ثم "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).');
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) return null;

  return (
    <button
      type="button"
      onClick={handleInstall}
      aria-label="تثبيت التطبيق كـ PWA"
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
      style={{
        backgroundColor: palette.badgeBg,
        borderColor: palette.badgeBorder,
        color: palette.primaryColor,
      }}
      title="تثبيت التطبيق على جهازك للعمل المباشر"
    >
      <Download className="w-3.5 h-3.5" />
      <span>تثبيت التطبيق</span>
    </button>
  );
}

export function PWAFlowBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem('project_q_pwa_banner_dismissed');
      if (!isDismissed && !window.matchMedia('(display-mode: standalone)').matches) {
        setDismissed(false);
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('project_q_pwa_banner_dismissed', 'true');
    } catch {
      // Ignore
    }
  };

  if (dismissed) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 z-40 max-w-sm p-3 rounded-2xl bg-slate-900/95 border border-amber-500/30 text-slate-100 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span>تطبيق بوت(٢) يدعم العمل كتطبيق مستقل PWA مع تحديثات فورية.</span>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        aria-label="إغلاق التنبيه"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
