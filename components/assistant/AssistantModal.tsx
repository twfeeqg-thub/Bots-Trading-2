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
  AlertCircle,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  FileCode,
  FileUp,
  Plus,
  Loader2,
  Check
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeContext';
import {
  AIProvider,
  ChatMessage,
  CoinTechnicalAnalysis,
  NewsArticle,
  AssistantUserSettings,
  PROVIDERS_CONFIG,
  ChatAttachment,
  AttachmentType
} from './AssistantTypes';
import { AssistantSettingsModal } from './AssistantSettingsModal';
import { RangeCoinsTableModal } from './RangeCoinsTableModal';
import { RangeCoinScanItem } from '@/app/api/assistant/range-analysis/route';

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
  const [isRangeTableOpen, setIsRangeTableOpen] = useState<boolean>(false);

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

  // Attachment states (File, Image, Text snippet, Link)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [activeAttachmentMenu, setActiveAttachmentMenu] = useState<boolean>(false);
  const [attachmentModalType, setAttachmentModalType] = useState<'link' | 'text' | null>(null);
  const [linkInput, setLinkInput] = useState<string>('');
  const [isFetchingLink, setIsFetchingLink] = useState<boolean>(false);
  const [linkFetchError, setLinkFetchError] = useState<string | null>(null);
  const [textSnippetTitle, setTextSnippetTitle] = useState<string>('');
  const [textSnippetContent, setTextSnippetContent] = useState<string>('');
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, isLoading]);

  if (!isOpen) return null;

  const currentProviderConfig = PROVIDERS_CONFIG[settings.activeProvider];

  // Image Upload Handler
  const handleSelectImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('الحد الأقصى لحجم الصورة هو 8 ميغابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newAtt: ChatAttachment = {
        id: `img-${Date.now()}`,
        type: 'image',
        name: file.name,
        mimeType: file.type || 'image/png',
        size: file.size,
        content: dataUrl,
        url: dataUrl,
      };
      setPendingAttachments((prev) => [...prev, newAtt]);
      setActiveAttachmentMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Document/Data File Upload Handler
  const handleSelectDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      alert('الحد الأقصى لحجم الملف هو 4 ميغابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const textContent = event.target?.result as string;
      const newAtt: ChatAttachment = {
        id: `file-${Date.now()}`,
        type: 'file',
        name: file.name,
        mimeType: file.type || 'text/plain',
        size: file.size,
        content: textContent,
      };
      setPendingAttachments((prev) => [...prev, newAtt]);
      setActiveAttachmentMenu(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Web Link / URL Handler
  const handleAddLink = async () => {
    const url = linkInput.trim();
    if (!url) return;

    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      validUrl = `https://${url}`;
    }

    setIsFetchingLink(true);
    setLinkFetchError(null);

    try {
      const res = await fetch('/api/assistant/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validUrl }),
      });
      const data = await res.json();

      const title = data.title || validUrl;
      const snippet = data.snippet || validUrl;

      const newAtt: ChatAttachment = {
        id: `link-${Date.now()}`,
        type: 'link',
        name: title,
        url: validUrl,
        content: snippet,
      };

      setPendingAttachments((prev) => [...prev, newAtt]);
      setLinkInput('');
      setAttachmentModalType(null);
      setActiveAttachmentMenu(false);
    } catch {
      // Fallback: attach directly
      const newAtt: ChatAttachment = {
        id: `link-${Date.now()}`,
        type: 'link',
        name: validUrl,
        url: validUrl,
        content: validUrl,
      };
      setPendingAttachments((prev) => [...prev, newAtt]);
      setLinkInput('');
      setAttachmentModalType(null);
      setActiveAttachmentMenu(false);
    } finally {
      setIsFetchingLink(false);
    }
  };

  // Text Snippet Handler
  const handleAddTextSnippet = () => {
    const content = textSnippetContent.trim();
    if (!content) return;

    const newAtt: ChatAttachment = {
      id: `text-${Date.now()}`,
      type: 'text',
      name: textSnippetTitle.trim() || 'نص مقتبس',
      content,
      size: content.length,
    };

    setPendingAttachments((prev) => [...prev, newAtt]);
    setTextSnippetTitle('');
    setTextSnippetContent('');
    setAttachmentModalType(null);
    setActiveAttachmentMenu(false);
  };

  // Remove Attachment Handler
  const handleRemovePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSendMessage = async (textToSend?: string, contextData?: { market?: CoinTechnicalAnalysis; news?: NewsArticle[] }) => {
    const rawText = (textToSend || inputPrompt).trim();
    const currentAttachments = [...pendingAttachments];

    if (!rawText && currentAttachments.length === 0) return;
    if (isLoading) return;

    let text = rawText;
    if (!text && currentAttachments.length > 0) {
      const firstType = currentAttachments[0].type;
      text =
        firstType === 'image'
          ? 'يرجى مراجعة هذه الصورة وفحص الشارت أو البيانات المرفقة بها وتحليلها بدقة.'
          : firstType === 'file'
          ? `يرجى مراجعة ملف "${currentAttachments[0].name}" وتحليل بياناته فنيًا واقتصاديًا.`
          : firstType === 'link'
          ? `يرجى دراسة وتلخيص هذا الرابط وتوضيح أثره: ${currentAttachments[0].url || currentAttachments[0].name}`
          : 'يرجى مراجعة النص المقتبس المرفق وتقديم تحليلك له.';
    }

    const userMessage: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      metadata: {
        technicalAnalysis: contextData?.market,
        newsArticles: contextData?.news,
        attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      },
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputPrompt('');
    setPendingAttachments([]);
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
          attachments: currentAttachments,
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

  // Handle selecting a coin from range detection table into chat
  const handleSelectCoinFromRangeTable = (symbol: string, item: RangeCoinScanItem) => {
    setSelectedSymbol(symbol);
    const promptText = `قدم لي تقييمًا تحليليًا تفصيليًا للعملة العرضية ${symbol}:
- السعر الحالي: ${item.currentPrice}
- مستوى الدعم: ${item.supportPrice} | مستوى المقاومة: ${item.resistancePrice}
- النطاق الإجمالي: ${item.grossRangePercent.toFixed(2)}% | النطاق القابل للتحقيق (بعد اقتطاع 15%): ${item.realizableRangePercent.toFixed(2)}%
- التكاليف المقدرة: ${item.totalFrictionPercent.toFixed(2)}% (رسوم مؤكدة ${item.confirmedFeePercent}% + انزلاق ${item.assumedSlippagePercent}%)
- صافي الجدوى بعد الرسوم: ${item.netRealizableMarginPercent.toFixed(2)}%
- درجة جودة النطاق: ${item.qualityScore}/100 | التصنيف: ${item.classification}
ما هو تقييمك لجدوى الحركة العرضية الحالية والمخاطر المحتملة؟`;

    handleSendMessage(promptText);
  };

  // Quick switch provider on error or user request
  const handleQuickSwitchProvider = (newProvider: AIProvider) => {
    const config = PROVIDERS_CONFIG[newProvider];
    const available = settings.dynamicModels?.[newProvider] && settings.dynamicModels[newProvider]!.length > 0
      ? settings.dynamicModels[newProvider]!
      : config.models;
    setSettings((prev) => ({
      ...prev,
      activeProvider: newProvider,
      activeModel: available[0]?.id || config.defaultModel,
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
        className={`theme-modal-dialog fixed z-50 transition-all duration-300 flex flex-col shadow-2xl border ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        } ${
          // Mobile: Bottom sheet
          'bottom-0 left-0 right-0 rounded-t-2xl max-h-[90dvh] md:rounded-2xl md:bottom-6 md:right-6 md:left-auto overflow-hidden '
        } ${
          // Desktop sizing: normal vs expanded
          isExpanded
            ? 'md:w-[720px] md:h-[85vh] h-[90dvh]'
            : 'md:w-[440px] md:h-[700px] h-[82dvh]'
        }`}
      >
        {/* Header Bar */}
        <div className={`theme-modal-header p-3.5 border-b flex items-center justify-between shrink-0 select-none ${
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
                <h2 className="theme-heading text-sm font-bold tracking-tight">المساعد الذكي للتحليل</h2>
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
          <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
            <input
              type="text"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
              placeholder="الرمز مثلا BTCUSDT"
              className={`w-24 sm:w-28 px-2 py-1 rounded-lg border font-mono text-xs uppercase focus:outline-hidden ${
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

          <div className="flex items-center gap-1.5">
            {/* Range Coins Analysis Trigger */}
            <button
              type="button"
              onClick={() => setIsRangeTableOpen(true)}
              className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 text-[11px] transition-colors cursor-pointer ${
                isLight
                  ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-800 shadow-2xs'
                  : 'bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 shadow-2xs'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>العملات العرضية</span>
            </button>

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
                    {/* Render Message Attachments (if any) */}
                    {msg.metadata?.attachments && msg.metadata.attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {msg.metadata.attachments.map((att) => (
                          <div key={att.id} className="text-xs">
                            {att.type === 'image' && att.content && (
                              <div className="relative group overflow-hidden rounded-xl border border-emerald-500/30 bg-black/40">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={att.content}
                                  alt={att.name}
                                  className="max-h-48 rounded-xl object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setPreviewImageModal(att.content!)}
                                />
                                <div className="p-1.5 flex items-center justify-between text-[10px] text-slate-300 bg-black/60 backdrop-blur-xs">
                                  <span className="truncate max-w-[160px] font-mono">{att.name}</span>
                                  <span className="text-emerald-400 font-bold">صورة 🔍</span>
                                </div>
                              </div>
                            )}

                            {att.type === 'file' && (
                              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                                isUser ? 'bg-emerald-700/60 border-emerald-500/40 text-white' : 'bg-slate-900/60 border-slate-700 text-slate-200'
                              }`}>
                                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div className="flex-1 min-w-0 text-[11px]">
                                  <div className="font-semibold truncate">{att.name}</div>
                                  <div className="text-[9px] opacity-75">
                                    ملف مرفق {att.size ? `(${(att.size / 1024).toFixed(1)} KB)` : ''}
                                  </div>
                                </div>
                              </div>
                            )}

                            {att.type === 'link' && (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors hover:border-emerald-400 block ${
                                  isUser ? 'bg-emerald-700/60 border-emerald-500/40 text-white' : 'bg-slate-900/60 border-slate-700 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                                  <div className="min-w-0 text-[11px]">
                                    <div className="font-semibold truncate">{att.name || att.url}</div>
                                    <div className="text-[9px] opacity-75 truncate">{att.url}</div>
                                  </div>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              </a>
                            )}

                            {att.type === 'text' && (
                              <div className={`p-2.5 rounded-xl border text-[11px] ${
                                isUser ? 'bg-emerald-700/60 border-emerald-500/40 text-white' : 'bg-slate-900/60 border-slate-700 text-slate-200'
                              }`}>
                                <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-400">
                                  <FileCode className="w-3.5 h-3.5" />
                                  <span>{att.name}</span>
                                </div>
                                <div className="text-[10px] font-mono whitespace-pre-wrap max-h-32 overflow-y-auto bg-black/20 p-1.5 rounded-lg">
                                  {att.content}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

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

                    {/* Error Banner with 1-Click Provider Switch & Settings */}
                    {errorType && (
                      <div className={`mt-2 p-2.5 rounded-xl border text-xs space-y-2 ${
                        isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                      }`}>
                        <div className="flex items-center gap-1.5 font-semibold text-rose-500">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            {errorType === 'model_not_found'
                              ? 'النموذج غير متوفر لدى المزود (Model Not Found)'
                              : errorType === 'quota_exceeded'
                              ? 'نفدت الحصة المجانية لهذا النموذج (Rate Limit / Quota)'
                              : errorType === 'invalid_key'
                              ? 'مفتاح API غير صالح أو غير مدخل'
                              : 'خطأ في الاتصال'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {errorType === 'model_not_found'
                            ? 'اسم النموذج المحدد قديم أو أوقفه المزود. يمكنك فتح الإعدادات والضغط على «تحديث النماذج المتاحة من المزود 🔄» لاختيار أحد النماذج المعتمدة حاليًا:'
                            : 'يمكنك التبديل الفوري لمزود آخر أو فتح الإعدادات لتعديل المفاتيح والنماذج:'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsSettingsOpen(true)}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <span>فتح الإعدادات لتحديث النماذج 🔄</span>
                          </button>
                          {(Object.keys(PROVIDERS_CONFIG) as AIProvider[])
                            .filter((p) => p !== settings.activeProvider)
                            .map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => handleQuickSwitchProvider(p)}
                                className="px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-700 text-slate-200 text-[10px] font-medium transition-colors"
                              >
                                التبديل إلى {PROVIDERS_CONFIG[p].name}
                              </button>
                            ))}
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
        <div className={`p-3 border-t shrink-0 relative ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
          {/* Pending Attachments Strip */}
          {pendingAttachments.length > 0 && (
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] text-slate-400 font-semibold shrink-0">المرفقات ({pendingAttachments.length}):</span>
              {pendingAttachments.map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] shrink-0 ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-800'
                      : 'bg-slate-950 border-slate-700 text-slate-200'
                  }`}
                >
                  {att.type === 'image' && <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />}
                  {att.type === 'file' && <FileText className="w-3.5 h-3.5 text-blue-400" />}
                  {att.type === 'link' && <LinkIcon className="w-3.5 h-3.5 text-sky-400" />}
                  {att.type === 'text' && <FileCode className="w-3.5 h-3.5 text-amber-400" />}
                  <span className="max-w-[120px] truncate">{att.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePendingAttachment(att.id)}
                    className="p-0.5 hover:bg-slate-700/50 rounded text-slate-400 hover:text-rose-400"
                    title="إزالة المرفق"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file inputs for attachments */}
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleSelectImageFile}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleSelectDocFile}
            accept=".txt,.json,.csv,.md,.log,.pdf"
            className="hidden"
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            {/* Attachment Button & Popup Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveAttachmentMenu(!activeAttachmentMenu)}
                title="إرفاق ملف، صورة، نص، أو رابط"
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                  pendingAttachments.length > 0
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : isLight
                    ? 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                {pendingAttachments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center justify-center">
                    {pendingAttachments.length}
                  </span>
                )}
              </button>

              {/* Attachment Selection Menu */}
              {activeAttachmentMenu && (
                <div
                  className={`absolute bottom-12 right-0 z-50 w-56 rounded-xl border shadow-xl p-1.5 space-y-1 animate-in fade-in duration-150 ${
                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      imageInputRef.current?.click();
                    }}
                    className={`w-full p-2 rounded-lg text-right text-xs flex items-center gap-2.5 transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[11px]">رفع صورة أو شارت</div>
                      <div className="text-[9px] text-slate-400">PNG, JPG, WEBP</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className={`w-full p-2 rounded-lg text-right text-xs flex items-center gap-2.5 transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[11px]">رفع ملف بيانات / مستند</div>
                      <div className="text-[9px] text-slate-400">CSV, JSON, TXT, MD</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentModalType('link');
                      setActiveAttachmentMenu(false);
                    }}
                    className={`w-full p-2 rounded-lg text-right text-xs flex items-center gap-2.5 transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                      <LinkIcon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[11px]">إضافة رابط ويب (URL)</div>
                      <div className="text-[9px] text-slate-400">مقال، خبر، أو منصة</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentModalType('text');
                      setActiveAttachmentMenu(false);
                    }}
                    className={`w-full p-2 rounded-lg text-right text-xs flex items-center gap-2.5 transition-colors ${
                      isLight ? 'hover:bg-slate-100' : 'hover:bg-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <FileCode className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-semibold text-[11px]">لصق نص مقتبس</div>
                      <div className="text-[9px] text-slate-400">ملاحظات أو كود أو أرقام</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

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
                placeholder={
                  pendingAttachments.length > 0
                    ? "اكتب استفسارك أو تعليماتك بخصوص المرفقات..."
                    : "اسأل عن تحليل عملة، مستويات الدعم، أو ارفع ملف/صورة/رابط..."
                }
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
              disabled={(!inputPrompt.trim() && pendingAttachments.length === 0) || isLoading}
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

      {/* Link Attachment Modal */}
      {attachmentModalType === 'link' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-4 shadow-2xl space-y-3 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold">إرفاق رابط ويب لتحليله</h3>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentModalType(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">عنوان الرابط (URL):</label>
              <input
                type="url"
                placeholder="https://example.com/crypto-news..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-hidden ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950 border-slate-700'
                }`}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                يمكنك إرفاق رابط مقال، خبر، أو منصة تحليلات لدراسته.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
              <button
                type="button"
                onClick={() => setAttachmentModalType(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddLink}
                disabled={!linkInput.trim() || isFetchingLink}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {isFetchingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isFetchingLink ? 'جاري الفحص...' : 'إرفاق الرابط'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Snippet Modal */}
      {attachmentModalType === 'text' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-4 shadow-2xl space-y-3 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold">لصق نص مقتبس أو ملاحظات إضافية</h3>
              </div>
              <button
                type="button"
                onClick={() => setAttachmentModalType(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">عنوان المقتطف (اختياري):</label>
              <input
                type="text"
                placeholder="مثال: ملاحظات دعم البيتكوين"
                value={textSnippetTitle}
                onChange={(e) => setTextSnippetTitle(e.target.value)}
                className={`w-full px-3 py-1.5 rounded-xl border text-xs focus:outline-hidden ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950 border-slate-700'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1">النص أو الأرقام المراد إرفاقها:</label>
              <textarea
                rows={5}
                placeholder="الصق هنا أي نص أو أرقام أو مؤشرات تريد من المساعد دراستها..."
                value={textSnippetContent}
                onChange={(e) => setTextSnippetContent(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-mono resize-none focus:outline-hidden ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950 border-slate-700'
                }`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
              <button
                type="button"
                onClick={() => setAttachmentModalType(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs hover:bg-slate-800"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddTextSnippet}
                disabled={!textSnippetContent.trim()}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>إرفاق النص</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImageModal(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImageModal(null)}
              className="absolute -top-10 left-0 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageModal}
              alt="معاينة الصورة المكبرة"
              className="max-h-[85vh] max-w-full rounded-2xl border border-slate-700 shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <AssistantSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings(newSettings)}
        isLight={isLight}
      />

      {/* Range Coins Analysis Table Modal */}
      <RangeCoinsTableModal
        isOpen={isRangeTableOpen}
        onClose={() => setIsRangeTableOpen(false)}
        onSelectCoinForChat={handleSelectCoinFromRangeTable}
      />
    </>
  );
}
