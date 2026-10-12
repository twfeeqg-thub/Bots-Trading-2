'use client';

import React, { useState } from 'react';
import { 
  X, 
  Key, 
  ShieldCheck, 
  Cpu, 
  ExternalLink, 
  Check, 
  Sparkles,
  AlertTriangle,
  RefreshCw,
  PlusCircle
} from 'lucide-react';
import { 
  AIProvider, 
  PROVIDERS_CONFIG, 
  AssistantUserSettings, 
  ProviderModelConfig 
} from './AssistantTypes';

interface AssistantSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AssistantUserSettings;
  onUpdateSettings: (newSettings: AssistantUserSettings) => void;
  isLight: boolean;
}

export function AssistantSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  isLight,
}: AssistantSettingsModalProps) {
  const [activeProvider, setActiveProvider] = useState<AIProvider>(settings.activeProvider);
  const [activeModel, setActiveModel] = useState<string>(settings.activeModel);
  const [apiKeys, setApiKeys] = useState<Partial<Record<AIProvider, string>>>({ ...settings.apiKeys });
  const [dynamicModels, setDynamicModels] = useState<Partial<Record<AIProvider, ProviderModelConfig[]>>>(
    settings.dynamicModels || {}
  );
  const [customModelInput, setCustomModelInput] = useState<string>(settings.customModelInput || '');
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const currentConfig = PROVIDERS_CONFIG[activeProvider];
  const hasDynamicList = !!(dynamicModels[activeProvider] && dynamicModels[activeProvider]!.length > 0);
  const rawModels: ProviderModelConfig[] = hasDynamicList
    ? dynamicModels[activeProvider]!
    : currentConfig.models;

  // Highlight and sort free models to top for OpenRouter
  const currentModels: ProviderModelConfig[] = [...rawModels].sort((a, b) => {
    if (activeProvider === 'openrouter') {
      const aFree = !!(a.isFree || a.id.endsWith(':free') || a.name.toLowerCase().includes('free') || a.name.includes('مجاني'));
      const bFree = !!(b.isFree || b.id.endsWith(':free') || b.name.toLowerCase().includes('free') || b.name.includes('مجاني'));
      if (aFree && !bFree) return -1;
      if (!aFree && bFree) return 1;
    }
    return 0;
  });

  // Change provider without automatic querying
  const handleProviderChange = (provider: AIProvider) => {
    setActiveProvider(provider);
    setRefreshMessage(null);
    const available = dynamicModels[provider] && dynamicModels[provider]!.length > 0
      ? dynamicModels[provider]!
      : PROVIDERS_CONFIG[provider].models;
    setActiveModel(available[0]?.id || PROVIDERS_CONFIG[provider].defaultModel);
  };

  const handleKeyChange = (val: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [activeProvider]: val.trim(),
    }));
  };

  // Explicit user click ONLY (no automatic querying)
  const handleFetchAvailableModels = async () => {
    setIsRefreshingModels(true);
    setRefreshMessage(null);

    try {
      const activeKey = apiKeys[activeProvider];
      const res = await fetch('/api/assistant/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          customApiKey: activeKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRefreshMessage({
          type: 'error',
          text: data.error || 'فشل الاستعلام عن النماذج المتاحة من المزود.',
        });
        return;
      }

      if (data.models && Array.isArray(data.models) && data.models.length > 0) {
        const fetchedModels: ProviderModelConfig[] = data.models;
        setDynamicModels((prev) => ({
          ...prev,
          [activeProvider]: fetchedModels,
        }));
        
        // Ensure active model is selected or fallback
        const exists = fetchedModels.some((m) => m.id === activeModel);
        if (!exists) {
          setActiveModel(fetchedModels[0].id);
        }

        setRefreshMessage({
          type: 'success',
          text: `تم استرداد ${fetchedModels.length} نموذج متاح بنجاح من ${currentConfig.name}!`,
        });
      } else {
        setRefreshMessage({
          type: 'error',
          text: 'لم يُرجع المزود أي نماذج صالحة للاستخدام.',
        });
      }
    } catch {
      setRefreshMessage({
        type: 'error',
        text: 'تعذر الاتصال بـ API المزود. يرجى التحقق من اتصالك بالإنترنت أو صحة المفتاح.',
      });
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const handleApplyCustomModel = () => {
    const trimmed = customModelInput.trim();
    if (!trimmed) return;
    setActiveModel(trimmed);
    setRefreshMessage({
      type: 'success',
      text: `تم تعيين النموذج المخصص: "${trimmed}"`,
    });
  };

  const handleSave = () => {
    onUpdateSettings({
      activeProvider,
      activeModel,
      apiKeys,
      dynamicModels,
      customModelInput,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/60'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isLight ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">إعدادات المساعد الذكي والمزودين</h3>
              <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                اختر المزود، حدّث النماذج المتاحة حياً، أو أدخل نموذجًا مخصصًا
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* In-Memory Security Guarantee Callout */}
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            isLight
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          }`}>
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="block font-semibold mb-0.5">أمان كامل بدون تخزين دائم:</strong>
              مفاتيح API تُحفظ في <strong>ذاكرة الجلسة النشطة (In-Memory) فقط</strong> ولا تُحفظ أبدًا في localStorage أو قواعد البيانات لضمان أعلى مستويات الخصوصية والأمان.
            </div>
          </div>

          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-xs font-semibold mb-2">
              مزود الذكاء الاصطناعي (AI Provider):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PROVIDERS_CONFIG) as AIProvider[]).map((pid) => {
                const p = PROVIDERS_CONFIG[pid];
                const isSelected = activeProvider === pid;
                const hasKey = !!apiKeys[pid];
                const count = dynamicModels[pid]?.length || p.models.length;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => handleProviderChange(pid)}
                    className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      isSelected
                        ? isLight
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                          : 'border-emerald-500 bg-emerald-950/40 text-emerald-200 ring-2 ring-emerald-500/30'
                        : isLight
                        ? 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700'
                        : 'border-slate-800 bg-slate-950/50 hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-semibold text-xs">{p.name}</span>
                      {p.id === 'gemini' && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                          افتراضي
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{count} نماذج</span>
                      {hasKey && <span className="text-emerald-500 font-semibold">✓ مفتاح متوفر</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-500" />
                <span>مفتاح API الخاص بـ {currentConfig.name}:</span>
              </label>
              <a
                href={currentConfig.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-emerald-500 hover:underline flex items-center gap-1"
              >
                <span>الحصول على مفتاح</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              placeholder={currentConfig.keyPlaceholder}
              value={apiKeys[activeProvider] || ''}
              onChange={(e) => handleKeyChange(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl border font-mono text-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900'
                  : 'bg-slate-950 border-slate-800 text-slate-100'
              }`}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {currentConfig.requiresKey
                ? 'مطلوب إدخال المفتاح لتشغيل واستعلام نماذج هذا المزود.'
                : 'اختياري لـ Gemini: إذا لم تدخله، سيعمل المساعد بالمفتاح الافتراضي المدمج.'}
            </p>
          </div>

          {/* Dynamic Model Discovery & Model Selection */}
          <div className="space-y-2.5 pt-1 border-t border-slate-800/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold">
                  نماذج التحليل لـ ({currentConfig.name}):
                </label>
                {hasDynamicList && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                    مستعلم حياً من المزود
                  </span>
                )}
              </div>

              {/* Explicit User Refresh Button */}
              <button
                type="button"
                onClick={handleFetchAvailableModels}
                disabled={isRefreshingModels}
                className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
                title="استعلام حي عن قائمة النماذج المتاحة من خوادم المزود حالياً"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingModels ? 'animate-spin' : ''}`} />
                <span>{isRefreshingModels ? 'جاري الاستعلام عن النماذج...' : 'تحديث النماذج المتاحة من المزود 🔄'}</span>
              </button>
            </div>

            {/* Refresh Feedback Message */}
            {refreshMessage && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in duration-200 ${
                  refreshMessage.type === 'success'
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : isLight
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {refreshMessage.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{refreshMessage.text}</span>
              </div>
            )}

            {/* Models List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {currentModels.map((m) => {
                const isModelSelected = activeModel === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setActiveModel(m.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                      isModelSelected
                        ? isLight
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950'
                          : 'border-emerald-500 bg-emerald-950/30 text-emerald-200'
                        : isLight
                        ? 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        : 'border-slate-800 hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-emerald-400">{m.name}</span>
                        {(m.isFree || m.id.endsWith(':free') || m.name.toLowerCase().includes('free') || m.name.includes('مجاني')) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1 shadow-xs">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                            <span>مجاني / Free</span>
                          </span>
                        )}
                        {m.id === currentConfig.defaultModel && (
                          <span className="text-[9px] text-slate-400">(الموصى به)</span>
                        )}
                        {m.isDynamic && (
                          <span className="text-[9px] text-sky-400 bg-sky-500/10 px-1 rounded">حي</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{m.description}</p>
                    </div>
                    {isModelSelected && (
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom Model Manual Entry Section */}
            <div className={`p-3 rounded-xl border space-y-2 mt-2 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-semibold flex items-center gap-1 text-slate-300">
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>إدخال نموذج مخصص يدويًا (Custom Model ID):</span>
                </label>
                <span className="text-[10px] text-slate-500">لأي نموذج جديد غير مدرج</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="مثال: llama-3.3-70b-versatile أو deepseek-chat"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg border font-mono text-xs transition-colors focus:outline-hidden ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900'
                      : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleApplyCustomModel}
                  disabled={!customModelInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium text-xs transition-colors shrink-0"
                >
                  اعتماد
                </button>
              </div>
              {activeModel && (
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>النموذج النشط حاليًا:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{activeModel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-end gap-2 ${
          isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-950/60'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
              isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-100' : 'border-slate-800 text-slate-400 hover:bg-slate-800'
            }`}
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            {saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>تم الحفظ</span>
              </>
            ) : (
              <span>تطبيق الإعدادات</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
