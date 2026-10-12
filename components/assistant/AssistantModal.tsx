'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  Settings,
  Trash2,
  TrendingUp,
  TrendingDown,
  Activity,
  Globe,
  ExternalLink,
  ShieldAlert,
  RotateCcw,
  Bot,
  User,
  ArrowUpRight,
  Layers,
  Clock,
  Compass,
  AlertCircle
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';
import {
  AIProvider,
  ChatMessage,
  CoinTechnicalAnalysis,
  NewsArticle,
  AssistantUserSettings,
  PROVIDERS_CONFIG
} from './AssistantTypes';
import { AssistantSettingsModal } from './AssistantSettingsModal';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentChartSymbol?: string | null;
}

const DEFAULT_SETTINGS: AssistantUserSettings = {
  activeProvider: 'gemini',
  activeModel: 'gemini-2.5-flash',
  apiKeys: {},
};

const POPULAR_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];
const TIMEFRAMES = [
  { id: '1m', label: '1 دقيقة' },
  { id: '5m', label: '5 دقائق' },
  { id: '15m', label: '15 دقيقة' },
  { id: '1h', label: '1 ساعة' },
  { id: '4h', label: '4 ساعات' },
  { id: '1d', label: '1 يوم' },
];

export function AssistantModal({
  isOpen,
  onClose,
  currentChartSymbol,
}: AssistantModalProps) {
  const { isLight } = useTheme();

  // Modal dimensions state
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // In-Memory settings state (keys are never persisted in localStorage)
  const [settings, setSettings] = useState<AssistantUserSettings>(DEFAULT_SETTINGS);

  // Quick Action controls
  const [prevChartSymbol, setPrevChartSymbol] = useState(currentChartSymbol);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    currentChartSymbol ? currentChartSymbol.toUpperCase() : 'BTCUSDT'
  );
  const [selectedInterval, setSelectedInterval] = useState<string>('1h');

  if (currentChartSymbol !== prevChartSymbol) {
    setPrevChartSymbol(currentChartSymbol);
    if (currentChartSymbol) {
      setSelectedSymbol(currentChartSymbol.toUpperCase());
    }
  }

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `مرحبًا بك! أنا **المساعد الذكي المستقل** لتحليل العملات والأسواق.
      
يمكنك طرح أي سؤال فني، طلب تحليل مؤشرات الشموع الحية، أو استعراض أحدث أخبار العملات والاقتصاد.

> **تنبيه:** هذا المساعد تحليلي واستشاري فقط، ومفصول تمامًا عن محرك التداول ولا ينفذ أي أوامر شراء أو بيع.`,
      timestamp: 1700000000000,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isFetchingNews, setIsFetchingNews] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  if (!isOpen) return null;

  const currentProviderConfig = PROVIDERS_CONFIG[settings.activeProvider];

  const handleSendMessage = async (textToSend?: string, contextData?: { market?: CoinTechnicalAnalysis; news?: NewsArticle[] }) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      metadata: {
        technicalAnalysis: contextData?.market,
        newsArticles: contextData?.news,
      },
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const activeKey = settings.apiKeys[settings.activeProvider] || '';

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          provider: settings.activeProvider,
          model: settings.activeModel,
          customApiKey: activeKey,
          marketContext: contextData?.market,
          newsContext: contextData?.news,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorType = data.errorType || 'network_error';
        const errMessage: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: data.error || 'حدث خطأ أثناء معالجة الطلب.',
          timestamp: Date.now(),
          provider: settings.activeProvider,
          model: settings.activeModel,
          metadata: {
            errorType,
          },
        };
        setMessages((prev) => [...prev, errMessage]);
      } else {
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: Date.now(),
          provider: settings.activeProvider,
          model: settings.activeModel,
          metadata: {
            technicalAnalysis: contextData?.market,
            newsArticles: contextData?.news,
          },
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch {
      const fallbackErr: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'تعذر الاتصال بخدمة التحليل الذكي. يرجى التحقق من اتصالك بالإنترنت أو إعادة المحاولة.',
        timestamp: Date.now(),
        provider: settings.activeProvider,
        metadata: {
          errorType: 'network_error',
        },
      };
      setMessages((prev) => [...prev, fallbackErr]);
    } finally {
      setIsLoading(false);
    }
  };

  // Perform Real Technical Analysis
  const handleRunTechnicalAnalysis = async (symbolOverride?: string) => {
    const sym = (symbolOverride || selectedSymbol).trim().toUpperCase();
    if (!sym || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/assistant/analysis?symbol=${encodeURIComponent(sym)}&interval=${selectedInterval}`);
      if (!res.ok) {
        throw new Error('فشل جلب بيانات التحليل');
      }
      const analysis: CoinTechnicalAnalysis = await res.json();

      const promptText = `قدم لي تحليلًا فنيًا تفصيليًا لعملة ${sym} بإطار ${selectedInterval}، واشرح دلالات المتوسطات ومؤشر RSI ومستويات الدعم والمقاومة الحالية بناءً على بيانات السوق الفعلية.`;

      await handleSendMessage(promptText, { market: analysis });
    } catch (err: any) {
      const errMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `تعذر جلب البيانات الفنية المباشرة للرمز ${sym}. تأكد من صحة الرمز أو جرب عملة أخرى.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fetch Latest Crypto News
  const handleFetchCryptoNews = async () => {
    if (isFetchingNews) return;
    setIsFetchingNews(true);

    try {
      const res = await fetch('/api/assistant/news');
      if (!res.ok) throw new Error('فشل جلب الأخبار');
      const data = await res.json();
      const articles: NewsArticle[] = data.articles || [];

      const promptText = `ما هي أهم مستجدات وأخبار العملات الرقمية اليوم؟ لخص العناوين الرئيسية وأثرها المحتمل على حركة الأسواق مع ذكر المصادر والتواريخ.`;

      await handleSendMessage(promptText, { news: articles });
    } catch {
      const errMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'تعذر جلب خلاصات الأخبار الحالية. يمكنك طرح سؤالك مباشرة.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsFetchingNews(false);
    }
  };

  // Quick switch provider on quota exhaustion
  const handleQuickSwitchProvider = (newProvider: AIProvider) => {
    const config = PROVIDERS_CONFIG[newProvider];
    setSettings((prev) => ({
      ...prev,
      activeProvider: newProvider,
      activeModel: config.defaultModel,
    }));
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: 'تم مسح المحادثة. كيف يمكنني مساعدتك في تحليل أسواق العملات الآن؟',
        timestamp: Date.now(),
        provider: settings.activeProvider,
        model: settings.activeModel,
      },
    ]);
  };

  // Simple Markdown Parser for clean Arabic text rendering
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      let trimmed = line.trim();

      // Blockquotes
      if (trimmed.startsWith('>')) {
        return (
          <div
            key={idx}
            className={`my-2 p-2.5 rounded-lg border-r-4 text-xs italic ${
              isLight
                ? 'bg-amber-50/70 border-amber-500 text-amber-900'
                : 'bg-amber-950/20 border-amber-400 text-amber-200'
            }`}
          >
            {trimmed.replace(/^>\s*/, '')}
          </div>
        );
      }

      // Headers
      if (trimmed.startsWith('###')) {
        return (
          <h4 key={idx} className="font-bold text-sm mt-3 mb-1 text-emerald-500">
            {trimmed.replace(/^###\s*/, '')}
          </h4>
        );
      }
      if (trimmed.startsWith('##')) {
        return (
          <h3 key={idx} className="font-bold text-base mt-3 mb-1 text-emerald-400">
            {trimmed.replace(/^##\s*/, '')}
          </h3>
        );
      }

      // Bullet items
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.replace(/^[-*]\s*/, '');
        return (
          <li key={idx} className="mr-4 my-0.5 text-xs list-disc leading-relaxed">
            {renderInlineMarkdown(itemText)}
          </li>
        );
      }

      // Numbered lists
      if (/^\d+\.\s/.test(trimmed)) {
        return (
          <li key={idx} className="mr-4 my-0.5 text-xs list-decimal leading-relaxed">
            {renderInlineMarkdown(trimmed.replace(/^\d+\.\s*/, ''))}
          </li>
        );
      }

      if (trimmed === '') {
        return <div key={idx} className="h-1.5" />;
      }

      return (
        <p key={idx} className="text-xs leading-relaxed my-1">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Bold **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-emerald-400">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* Backdrop for Mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs md:hidden"
        onClick={onClose}
      />

      {/* Main Assistant Panel / Drawer */}
      <div
        className={`fixed z-50 transition-all duration-300 flex flex-col shadow-2xl border ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        } ${
          // Mobile: Bottom sheet
          'bottom-0 left-0 right-0 rounded-t-2xl max-h-[92vh] md:rounded-2xl md:bottom-6 md:right-6 md:left-auto '
        } ${
          // Desktop sizing: normal vs expanded
          isExpanded
            ? 'md:w-[720px] md:h-[85vh] h-[92vh]'
            : 'md:w-[440px] md:h-[700px] h-[82vh]'
        }`}
      >
        {/* Header Bar */}
        <div className={`p-3.5 border-b flex items-center justify-between shrink-0 select-none ${
          isLight ? 'border-slate-200 bg-slate-50/90' : 'border-slate-800 bg-slate-950/80'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isLight ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">المساعد الذكي للتحليل</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
                  مستقل
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className={`text-[10px] flex items-center gap-1 hover:underline cursor-pointer ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                <span>{currentProviderConfig.name} ({settings.activeModel})</span>
                <Settings className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Clear Chat */}
            <button
              type="button"
              onClick={handleClearChat}
              title="مسح المحادثة"
              className={`p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Expand / Minimize Desktop */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'تصغير اللوحة' : 'توسيع اللوحة'}
              className={`hidden md:block p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Settings Trigger */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="إعدادات المزود ومفاتيح API"
              className={`p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="إغلاق"
              className={`p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick-Action Bar for Technical Analysis & News */}
        <div className={`p-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
          isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
        }`}>
          {/* Symbol & Timeframe Selector */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
            <input
              type="text"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
              placeholder="الرمز مثلا BTCUSDT"
              className={`w-28 px-2 py-1 rounded-lg border font-mono text-xs uppercase focus:outline-hidden ${
                isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
              }`}
            />
            <select
              value={selectedInterval}
              onChange={(e) => setSelectedInterval(e.target.value)}
              className={`px-2 py-1 rounded-lg border text-xs focus:outline-hidden ${
                isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
              }`}
            >
              {TIMEFRAMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleRunTechnicalAnalysis()}
              disabled={isAnalyzing}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium flex items-center gap-1 text-[11px] transition-colors"
            >
              <Activity className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'جاري التحليل...' : 'تحليل فني فوري'}</span>
            </button>
          </div>

          {/* Quick News Trigger */}
          <button
            type="button"
            onClick={handleFetchCryptoNews}
            disabled={isFetchingNews}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 text-[11px] transition-colors ${
              isLight
                ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200'
            }`}
          >
            <Globe className={`w-3 h-3 text-sky-400 ${isFetchingNews ? 'animate-spin' : ''}`} />
            <span>{isFetchingNews ? 'جلب الأخبار...' : 'أحدث الأخبار'}</span>
          </button>
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const hasTechCard = !!msg.metadata?.technicalAnalysis;
            const hasNewsCard = !!msg.metadata?.newsArticles && msg.metadata.newsArticles.length > 0;
            const errorType = msg.metadata?.errorType;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${
                    isUser
                      ? isLight
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : isLight
                      ? 'bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Body */}
                <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`p-3 rounded-2xl shadow-xs transition-colors ${
                      isUser
                        ? isLight
                          ? 'bg-emerald-600 text-white rounded-tr-xs'
                          : 'bg-emerald-600 text-slate-100 rounded-tr-xs'
                        : isLight
                        ? 'bg-slate-100 border border-slate-200 text-slate-900 rounded-tl-xs'
                        : 'bg-slate-800/80 border border-slate-700 text-slate-100 rounded-tl-xs'
                    }`}
                  >
                    {/* Render Formatted Markdown */}
                    {renderFormattedContent(msg.content)}

                    {/* Technical Analysis Real Calculated Card */}
                    {hasTechCard && msg.metadata?.technicalAnalysis && (
                      <div className={`mt-3 p-3 rounded-xl border text-xs space-y-2 ${
                        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950/80 border-slate-700/80 text-slate-200'
                      }`}>
                        <div className="flex items-center justify-between border-b pb-1.5 border-slate-700/40">
                          <div className="flex items-center gap-1.5 font-bold">
                            <Activity className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{msg.metadata.technicalAnalysis.symbol} ({msg.metadata.technicalAnalysis.interval})</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            msg.metadata.technicalAnalysis.trend === 'صاعد'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : msg.metadata.technicalAnalysis.trend === 'هابط'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            الاتجاه: {msg.metadata.technicalAnalysis.trend}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block text-[10px]">السعر الحالي:</span>
                            <span className="font-mono font-bold">{msg.metadata.technicalAnalysis.lastPrice} USDT</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">مؤشر RSI(14):</span>
                            <span className="font-mono font-bold">
                              {msg.metadata.technicalAnalysis.rsi} ({msg.metadata.technicalAnalysis.rsiCondition})
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">المتوسطات EMA:</span>
                            <span className="font-mono text-[10px]">
                              9: {msg.metadata.technicalAnalysis.ema9} | 20: {msg.metadata.technicalAnalysis.ema20}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">الدعم والمقاومة:</span>
                            <span className="font-mono text-[10px]">
                              S1: {msg.metadata.technicalAnalysis.supportLevels[0]} | R1: {msg.metadata.technicalAnalysis.resistanceLevels[0]}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-slate-700/40 flex items-center justify-between text-[9px] text-slate-400">
                          <span>المصدر: {msg.metadata.technicalAnalysis.source}</span>
                          <span>الوقت: {msg.metadata.technicalAnalysis.updatedAt}</span>
                        </div>
                      </div>
                    )}

                    {/* News Articles Cards */}
                    {hasNewsCard && msg.metadata?.newsArticles && (
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-semibold text-slate-400 block">المصادر الإخبارية المرجعية:</span>
                        {msg.metadata.newsArticles.slice(0, 4).map((art) => (
                          <a
                            key={art.id}
                            href={art.link}
                            target="_blank"
                            rel="noreferrer"
                            className={`block p-2 rounded-lg border text-xs transition-colors hover:border-emerald-500 ${
                              isLight ? 'bg-white border-slate-200' : 'bg-slate-950/70 border-slate-700'
                            }`}
                          >
                            <div className="font-semibold text-[11px] flex items-center justify-between gap-2">
                              <span className="line-clamp-1">{art.title}</span>
                              <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400">
                              <span>المصدر: {art.source}</span>
                              <span>•</span>
                              <span>{art.publishedAt}</span>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Error Banner with 1-Click Provider Switch */}
                    {errorType && (
                      <div className={`mt-2 p-2.5 rounded-xl border text-xs space-y-2 ${
                        isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                      }`}>
                        <div className="flex items-center gap-1.5 font-semibold text-rose-500">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            {errorType === 'quota_exceeded'
                              ? 'نفدت الحصة المجانية لهذا النموذج'
                              : errorType === 'invalid_key'
                              ? 'مفتاح API غير صالح أو غير مدخل'
                              : 'خطأ في الاتصال'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          يمكنك التبديل الفوري لمزود آخر مجاني أو إدخال مفتاح في الإعدادات:
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(['gemini', 'groq', 'openai', 'deepseek'] as AIProvider[])
                            .filter((p) => p !== settings.activeProvider)
                            .map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleQuickSwitchProvider(p)}
                                className="px-2 py-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white text-[10px] font-medium transition-colors"
                              >
                                التبديل إلى {PROVIDERS_CONFIG[p].name}
                              </button>
                            ))}
                          <button
                            type="button"
                            onClick={() => setIsSettingsOpen(true)}
                            className="px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-700 text-[10px] font-medium text-slate-200"
                          >
                            فتح الإعدادات
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Timestamp */}
                  <span className="text-[9px] text-slate-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>جاري التحليل وصياغة الرد الفني...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className={`px-3 py-2 border-t overflow-x-auto flex items-center gap-1.5 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
        }`}>
          {[
            { label: 'تحليل BTC', action: () => handleRunTechnicalAnalysis('BTCUSDT') },
            { label: 'تحليل ETH', action: () => handleRunTechnicalAnalysis('ETHUSDT') },
            { label: 'تحليل SOL', action: () => handleRunTechnicalAnalysis('SOLUSDT') },
            { label: 'أخبار اليوم', action: handleFetchCryptoNews },
            { label: 'شرح RSI', prompt: 'اشرح لي ببساطة كيف أستفيد من مؤشر RSI في تحديد القمم والقيعان؟' },
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (chip.action) chip.action();
                else if (chip.prompt) handleSendMessage(chip.prompt);
              }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border shrink-0 transition-all ${
                isLight
                  ? 'bg-white border-slate-300 hover:border-emerald-500 text-slate-700'
                  : 'bg-slate-900 border-slate-700 hover:border-emerald-500 text-slate-300'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className={`p-3 border-t shrink-0 ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="اسأل عن تحليل عملة، مستويات الدعم، أو مستجدات السوق..."
                rows={2}
                className={`w-full px-3 py-2 rounded-xl border text-xs resize-none transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                    : 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={!inputPrompt.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0 shadow-xs transition-all active:scale-95"
            >
              <Send className="w-4 h-4 -rotate-90" />
            </button>
          </form>

          {/* Separation Disclaimer */}
          <p className="text-[9px] text-center text-slate-500 mt-1.5">
            المساعد مخصص للتحليل والاستشارة الفنية فقط ولا ينفذ أوامر تداول.
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      <AssistantSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings(newSettings)}
        isLight={isLight}
      />
    </>
  );
}
