'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Sparkles,
  Maximize2,
  Minimize2,
  Minus,
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
  ArrowRight,
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
  Check,
  Copy,
  Camera,
  Download,
  Search,
  Scissors,
  CheckCircle2,
  ToggleLeft,
  ToggleRight
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
  AttachmentType,
  UNIFIED_ASSISTANT_TIMEFRAMES,
  AssistantSkill,
  DEFAULT_ASSISTANT_SKILLS
} from './AssistantTypes';
import { AssistantSettingsModal } from './AssistantSettingsModal';
import { RangeCoinsTableModal } from './RangeCoinsTableModal';
import { RangeCoinScanItem } from '@/app/api/assistant/range-analysis/route';
import { DEFAULT_EXECUTABLE_UNIVERSE } from '@/lib/scanner/universe';

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

const POPULAR_SYMBOLS = DEFAULT_EXECUTABLE_UNIVERSE.slice(0, 12).map((u) => u.symbol);

export function AssistantModal({
  isOpen,
  onClose,
  currentChartSymbol,
}: AssistantModalProps) {
  const { isLight } = useTheme();

  // Navigation tab: 'chat' | 'skills'
  const [activeTab, setActiveTab] = useState<'chat' | 'skills'>('chat');

  // Skills state (with ON/OFF toggle)
  const [skills, setSkills] = useState<AssistantSkill[]>(DEFAULT_ASSISTANT_SKILLS);

  // Window Management States
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  // Submodals
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isRangeTableOpen, setIsRangeTableOpen] = useState<boolean>(false);

  // Feedback Notification
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  // In-Memory settings state
  const [settings, setSettings] = useState<AssistantUserSettings>(DEFAULT_SETTINGS);

  // Quick Action controls
  const [prevChartSymbol, setPrevChartSymbol] = useState(currentChartSymbol);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    currentChartSymbol ? currentChartSymbol.toUpperCase() : 'BTCUSDT'
  );
  const [selectedInterval, setSelectedInterval] = useState<string>('1h');
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);
  const [symbolSearchQuery, setSymbolSearchQuery] = useState('');

  if (currentChartSymbol !== prevChartSymbol) {
    setPrevChartSymbol(currentChartSymbol);
    if (currentChartSymbol) {
      setSelectedSymbol(currentChartSymbol.toUpperCase());
    }
  }

  // Handle Dragging Window (Mouse + Touch)
  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a')) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;
      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    };
    const handleEnd = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Skill Toggle Handler (ON / OFF)
  const handleToggleSkill = (skillId: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skillId ? { ...s, isEnabled: !s.isEnabled } : s))
    );
  };

  // Response Tools: Copy Full Text
  const handleCopyFullText = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedNotice('تم نسخ كامل الرد بنجاح!');
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  // Response Tools: Copy Selected Text
  const handleCopySelectedText = (fallbackContent: string) => {
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      navigator.clipboard.writeText(selection);
      setCopiedNotice('تم نسخ الجزء المحدد بنجاح!');
    } else {
      navigator.clipboard.writeText(fallbackContent);
      setCopiedNotice('لم يتم تحديد نص، تم نسخ كامل الرد!');
    }
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  // Response Tools: Capture Image
  const handleCaptureMessageImage = (msg: ChatMessage) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 640;
      const padding = 28;
      const scale = 2; // High-DPI Retina
      const text = msg.content;
      const lines: string[] = [];
      const paragraphs = text.split('\n');

      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif';
      const maxTextWidth = width - padding * 2;

      paragraphs.forEach((p) => {
        if (!p.trim()) {
          lines.push('');
          return;
        }
        const words = p.split(' ');
        let currentLine = '';
        for (const w of words) {
          const testLine = currentLine ? `${currentLine} ${w}` : w;
          if (ctx.measureText(testLine).width > maxTextWidth) {
            lines.push(currentLine);
            currentLine = w;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
      });

      const lineHeight = 24;
      const headerHeight = 72;
      const techHeight = msg.metadata?.technicalAnalysis ? 130 : 0;
      const footerHeight = 44;
      const totalHeight = headerHeight + lines.length * lineHeight + techHeight + footerHeight + padding;

      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);

      const isDark = !isLight;
      const bgGradient = ctx.createLinearGradient(0, 0, 0, totalHeight);
      if (isDark) {
        bgGradient.addColorStop(0, '#090d16');
        bgGradient.addColorStop(1, '#0f172a');
      } else {
        bgGradient.addColorStop(0, '#f8fafc');
        bgGradient.addColorStop(1, '#f1f5f9');
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, totalHeight);

      // Border & Top Accent Line
      ctx.strokeStyle = isDark ? '#1e293b' : '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, width - 2, totalHeight - 2);

      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 0, width, 4);

      // Header Title & Meta (RTL Arabic)
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 15px "Noto Sans Arabic", -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('المساعد الذكي للتحليل — مشروع Q', width - padding, 36);

      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '11px "Noto Sans Arabic", sans-serif';
      const timeStr = new Date(msg.timestamp).toLocaleString('ar-SA');
      ctx.fillText(`التاريخ: ${timeStr} | المزود: ${msg.provider || 'AI Studio'}`, width - padding, 54);

      // Divider
      ctx.strokeStyle = isDark ? '#1e293b' : '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(padding, headerHeight);
      ctx.lineTo(width - padding, headerHeight);
      ctx.stroke();

      // Body Text Lines (RTL)
      let y = headerHeight + 28;
      ctx.font = '13.5px "Noto Sans Arabic", -apple-system, sans-serif';
      ctx.textAlign = 'right';

      lines.forEach((line) => {
        if (line.trim().startsWith('>')) {
          ctx.fillStyle = '#10b981';
        } else if (line.trim().startsWith('#') || line.trim().startsWith('**')) {
          ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
        } else {
          ctx.fillStyle = isDark ? '#f1f5f9' : '#0f172a';
        }
        ctx.fillText(line.replace(/[*#>`]/g, ''), width - padding, y);
        y += lineHeight;
      });

      // Technical Analysis Card if available
      if (msg.metadata?.technicalAnalysis) {
        y += 8;
        const ta = msg.metadata.technicalAnalysis;
        ctx.fillStyle = isDark ? '#131d2e' : '#e2e8f0';
        ctx.fillRect(padding, y, width - padding * 2, 105);
        ctx.strokeStyle = isDark ? '#223249' : '#cbd5e1';
        ctx.strokeRect(padding, y, width - padding * 2, 105);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 12px "Noto Sans Arabic", sans-serif';
        ctx.fillText(`بيانات فنية حية: ${ta.symbol} (${ta.interval})`, width - padding - 12, y + 24);

        ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
        ctx.font = '11px monospace, "Noto Sans Arabic", sans-serif';
        ctx.fillText(`السعر: ${ta.lastPrice} USDT | الاتجاه: ${ta.trend} | 24h: ${ta.change24h}%`, width - padding - 12, y + 46);
        ctx.fillText(`RSI(14): ${ta.rsi} (${ta.rsiCondition}) | حجم 24h: ${ta.volume24h}`, width - padding - 12, y + 68);
        ctx.fillText(`الدعم: ${ta.supportLevels.join(', ')} | المقاومة: ${ta.resistanceLevels.join(', ')}`, width - padding - 12, y + 90);
        y += 115;
      }

      // Footer
      y = totalHeight - 16;
      ctx.fillStyle = isDark ? '#64748b' : '#94a3b8';
      ctx.font = '10px "Noto Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('هذا الرد صادر عن المساعد الذكي للأغراض الاستشارية والتحليلية الفنية فقط ولا يمثل نصيحة مالية أو أمر تداول.', width / 2, y);

      // Download PNG
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `رد_المساعد_الذكي_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setCopiedNotice('تم حفظ صورة الرد بنجاح!');
      setTimeout(() => setCopiedNotice(null), 2500);
    } catch (err) {
      console.error('Failed to capture response image', err);
    }
  };

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
          skillsContext: skills.filter((s) => s.isEnabled),
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

  // Minimized Floating Bar
  if (isMinimized) {
    return (
      <div
        className={`fixed bottom-4 right-4 z-50 p-2.5 rounded-2xl border shadow-2xl flex items-center gap-3 transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsMinimized(false)}>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold block">المساعد الذكي للتحليل</span>
            <span className="text-[10px] text-emerald-400">نشط ({messages.length} رسالة)</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            title="استعادة النافذة"
            className="p-1.5 rounded-lg hover:bg-slate-700/30 text-emerald-400 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق"
            className="p-1.5 rounded-lg hover:bg-slate-700/30 text-slate-400 hover:text-rose-400 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Filter symbols for searchable combobox
  const filteredSymbols = DEFAULT_EXECUTABLE_UNIVERSE.filter((u) =>
    u.symbol.toLowerCase().includes(symbolSearchQuery.toLowerCase())
  ).slice(0, 8);

  const isValidSymbol = selectedSymbol.endsWith('USDT') && selectedSymbol.length >= 5;

  return (
    <>
      {/* Backdrop for Mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs md:hidden"
        onClick={onClose}
      />

      {/* Feedback Toast */}
      {copiedNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4" />
          <span>{copiedNotice}</span>
        </div>
      )}

      {/* Main Assistant Panel / Drawer */}
      <div
        style={{
          transform: isExpanded ? 'none' : `translate(${position.x}px, ${position.y}px)`,
        }}
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
            ? 'md:w-[780px] md:h-[88vh] h-[92dvh]'
            : 'md:w-[460px] md:h-[720px] h-[84dvh]'
        }`}
      >
        {/* Header Bar with Drag, Back & Window Controls */}
        <div
          onMouseDown={handleStartDrag}
          onTouchStart={handleStartDrag}
          className={`theme-modal-header p-3 sm:p-3.5 border-b flex items-center justify-between shrink-0 select-none cursor-move ${
            isLight ? 'border-slate-200 bg-slate-50/90' : 'border-slate-800 bg-slate-950/80'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Back Button (العودة إلى السابق) */}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'skills') setActiveTab('chat');
                else onClose();
              }}
              title={activeTab === 'skills' ? 'العودة إلى المحادثة' : 'العودة / إغلاق'}
              className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
                  : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span className="text-[10px] hidden sm:inline">{activeTab === 'skills' ? 'المحادثة' : 'عودة'}</span>
            </button>

            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              isLight ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="theme-heading text-xs sm:text-sm font-bold tracking-tight">المساعد الذكي للتحليل</h2>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30">
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
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Minimize */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              title="تصغير النافذة"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* Expand / Minimize Desktop */}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'استعادة الحجم الأصلي' : 'توسيع اللوحة'}
              className={`hidden md:block p-1.5 rounded-lg transition-colors cursor-pointer ${
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
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
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
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-slate-800 text-slate-400'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs (المحادثة والاستشارة | قسم المهارات) */}
        <div className={`flex items-center border-b px-2 text-xs font-medium shrink-0 ${
          isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'chat'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>المحادثة والاستشارة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`py-2 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'skills'
                ? 'border-emerald-500 text-emerald-500 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>قسم المهارات</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
              {skills.filter((s) => s.isEnabled).length} نشطة
            </span>
          </button>
        </div>

        {/* TAB 1: SKILLS SECTION */}
        {activeTab === 'skills' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Skills Header Banner */}
            <div className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            }`}>
              <div className="flex items-center gap-2 font-bold text-sm">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>نظام المهارات التحليلية للمساعد (Skills System)</span>
              </div>
              <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                تتيح لك المهارات تفعيل أو إيقاف قدرات التحليل المتخصصة. عند تفعيل المهارة (ON)، يقوم المساعد باختيارها تلقائيًا للإجابة عن أسئلتك، كما يمكنك تشغيل فحص المهارة يدويًا بنقرة واحدة دون الحاجة إلى كتابة سؤال.
              </p>
            </div>

            {/* Skills List */}
            <div className="space-y-3">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-950/70 border-slate-800 shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center border mt-0.5 ${
                        skill.isEnabled
                          ? isLight
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}>
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm">{skill.name}</h3>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            skill.isEnabled
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {skill.isEnabled ? 'مفعلة ON' : 'متوقفة OFF'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            {skill.category}
                          </span>
                        </div>
                        <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          {skill.description}
                        </p>
                      </div>
                    </div>

                    {/* ON / OFF Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleSkill(skill.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        skill.isEnabled ? 'bg-emerald-600' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                      }`}
                      title={skill.isEnabled ? 'إيقاف المهارة (OFF)' : 'تشغيل المهارة (ON)'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          skill.isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Manual Run Action & Execution Details */}
                  <div className="mt-3.5 pt-3 border-t border-slate-700/40 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span>الاستدعاء التلقائي:</span>
                      <span className={skill.isEnabled ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                        {skill.isEnabled ? 'مفعّل آليًا وفق استفسار المستخدم' : 'معطل (لن يتم تحميل التعليمات)'}
                      </span>
                    </div>

                    {/* Manual Run Button */}
                    <button
                      type="button"
                      onClick={() => setIsRangeTableOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>تشغيل وفحص العملات العرضية الآن 🚀</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Strict Guarantee Banner */}
            <div className={`p-3 rounded-xl border text-[11px] flex items-start gap-2 ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-slate-900/60 border-slate-800 text-slate-400'
            }`}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>تأكيد مطابقة النظام:</strong> المهارات المتوفرة مطابقة تمامًا للمحرك الفعلي. لا يدعي المساعد وجود أي مهارات إضافية غير منفذة، والمهارات المتوقفة (OFF) لا تُحمّل نهائيًا في سياق الطلب.
              </span>
            </div>

            {/* Return to Chat Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>العودة إلى شاشة المحادثة</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CHAT VIEW */}
        {activeTab === 'chat' && (
          <>
            {/* Quick-Action Bar for Technical Analysis & News */}
            <div className={`p-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 ${
              isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/40 border-slate-800/80'
            }`}>
              {/* Searchable Symbol & Unified Timeframe Selector */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap relative">
                {/* Searchable Symbol Combobox */}
                <div className="relative">
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={selectedSymbol}
                      onFocus={() => {
                        setSymbolSearchQuery('');
                        setIsSymbolDropdownOpen(true);
                      }}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setSelectedSymbol(val);
                        setSymbolSearchQuery(val);
                        setIsSymbolDropdownOpen(true);
                      }}
                      placeholder="بحث عملة..."
                      className={`w-28 sm:w-32 px-2.5 py-1 rounded-lg border font-mono text-xs uppercase focus:outline-hidden ${
                        isValidSymbol
                          ? isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700 text-emerald-400'
                          : 'border-rose-500 bg-rose-500/10'
                      }`}
                    />
                    <Search className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                  </div>

                  {/* Dropdown Suggestions */}
                  {isSymbolDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsSymbolDropdownOpen(false)}
                      />
                      <div className={`absolute top-full right-0 mt-1 w-48 rounded-xl border shadow-xl z-40 max-h-48 overflow-y-auto ${
                        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
                      }`}>
                        <div className="p-1.5 text-[10px] text-slate-400 border-b border-slate-700/50">
                          اختر زوج معتمد (Binance Spot):
                        </div>
                        {filteredSymbols.map((item) => (
                          <button
                            key={item.symbol}
                            type="button"
                            onClick={() => {
                              setSelectedSymbol(item.symbol);
                              setIsSymbolDropdownOpen(false);
                            }}
                            className="w-full text-right px-2.5 py-1.5 text-xs hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-between font-mono cursor-pointer"
                          >
                            <span>{item.symbol}</span>
                            <span className="text-[10px] text-slate-400">{item.baseAsset}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Unified Timeframe Selector */}
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                  className={`px-2 py-1 rounded-lg border text-xs focus:outline-hidden cursor-pointer ${
                    isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-700'
                  }`}
                >
                  {UNIFIED_ASSISTANT_TIMEFRAMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({t.id})
                    </option>
                  ))}
                </select>

                {/* Run Tech Analysis Button */}
                <button
                  type="button"
                  onClick={() => handleRunTechnicalAnalysis()}
                  disabled={isAnalyzing}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
                >
                  <Activity className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'جاري التحليل...' : 'تحليل فني فوري'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {/* News Trigger */}
                <button
                  type="button"
                  onClick={handleFetchCryptoNews}
                  disabled={isFetchingNews}
                  className={`px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 text-[11px] transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                      : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <Globe className={`w-3 h-3 text-sky-400 ${isFetchingNews ? 'animate-spin' : ''}`} />
                  <span>{isFetchingNews ? 'جلب الأخبار...' : 'أحدث الأخبار'}</span>
                </button>

                {/* Direct Skills Shortcut Tag */}
                <button
                  type="button"
                  onClick={() => setActiveTab('skills')}
                  className={`px-2 py-1 rounded-lg border text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                    isLight ? 'bg-slate-200/60 border-slate-300 text-slate-700' : 'bg-slate-800/60 border-slate-700 text-slate-300'
                  }`}
                  title="الانتقال إلى قسم المهارات"
                >
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span>مهارة العملات العرضية</span>
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

                  {/* Assistant Message Tools: Copy Full, Copy Selection, Capture Image */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-1.5 pt-1 text-[10px] text-slate-400">
                      <button
                        type="button"
                        onClick={() => handleCopyFullText(msg.content)}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                          isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                        }`}
                        title="نسخ الرد كاملًا"
                      >
                        <Copy className="w-3 h-3 text-emerald-400" />
                        <span>نسخ كامل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopySelectedText(msg.content)}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                          isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                        }`}
                        title="نسخ الجزء المحدد (حدد نصًا ثم اضغط)"
                      >
                        <Scissors className="w-3 h-3 text-sky-400" />
                        <span>نسخ المحدد</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCaptureMessageImage(msg)}
                        className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                          isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-slate-800 text-slate-300'
                        }`}
                        title="التقاط صورة واضحة للرد وحفظها"
                      >
                        <Camera className="w-3 h-3 text-amber-400" />
                        <span>التقاط صورة</span>
                      </button>
                    </div>
                  )}

                  {/* Message Timestamp */}
                  <span suppressHydrationWarning className="text-[9px] text-slate-500 mt-1 px-1">
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

        {/* Quick Suggestion Chips (Flexible based on chosen coin and indicators) */}
        <div className={`px-3 py-2 border-t overflow-x-auto flex items-center gap-1.5 shrink-0 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/50 border-slate-800'
        }`}>
          {[
            {
              label: `تحليل ${selectedSymbol} الآن`,
              action: () => handleRunTechnicalAnalysis(selectedSymbol),
              isHighlighted: true,
            },
            {
              label: `مؤشر RSI لـ ${selectedSymbol}`,
              prompt: `حلل لي قراءة مؤشر القوة النسبية RSI(14) لعملة ${selectedSymbol} ومستويات التشبع.`,
            },
            {
              label: `المتوسطات EMA لـ ${selectedSymbol}`,
              prompt: `ما هي قراءات وتقاطعات المتوسطات المتحركة EMA 9 و 20 و 50 لعملة ${selectedSymbol}؟`,
            },
            {
              label: `الدعم والمقاومة لـ ${selectedSymbol}`,
              prompt: `حدد لي أهم مستويات الدعم والمقاومة ونقطة الارتكاز Pivot لعملة ${selectedSymbol} بإطار ${selectedInterval}.`,
            },
            {
              label: 'أخبار اليوم',
              action: handleFetchCryptoNews,
            },
          ].map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (chip.action) chip.action();
                else if (chip.prompt) handleSendMessage(chip.prompt);
              }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border shrink-0 transition-all cursor-pointer ${
                chip.isHighlighted
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30 font-semibold'
                  : isLight
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
      </>
    )}
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
