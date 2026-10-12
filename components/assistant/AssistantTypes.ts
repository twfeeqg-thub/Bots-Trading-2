// Project Q — Smart Assistant Types & Contracts

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek';

export interface ProviderModelConfig {
  id: string;
  name: string;
  contextWindow?: string;
  description: string;
}

export interface ProviderInfo {
  id: AIProvider;
  name: string;
  models: ProviderModelConfig[];
  defaultModel: string;
  keyPlaceholder: string;
  docsUrl: string;
  hasFreeTier: boolean;
  requiresKey: boolean;
}

export const PROVIDERS_CONFIG: Record<AIProvider, ProviderInfo> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'أداء سريع وذكي ومثالي للتحليل الفني والأسواق' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: 'نموذج تفكير عميق للمقارنات المعقدة' },
      { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', description: 'أحدث إصدار مستقر للتحليل الفوري' },
    ],
    keyPlaceholder: 'AIzaSy... (اختياري، يتوفر مفتاح افتراضي)',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    hasFreeTier: true,
    requiresKey: false,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'سريع واقتصادي ومناسب للإجابات السريعة' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'أعلى دقة وقدرة استنتاجية' },
    ],
    keyPlaceholder: 'sk-proj-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    hasFreeTier: false,
    requiresKey: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'فائق السرعة ومناسب للتحليلات الخفيفة' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'تحليل دقيق وتفصيل استراتيجي متقن' },
    ],
    keyPlaceholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    hasFreeTier: false,
    requiresKey: true,
  },
  groq: {
    id: 'groq',
    name: 'Groq (Llama / Mixtral)',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', description: 'استجابة فائقة السرعة مع قدرات تحليل عالية' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'أسرع نموذج للإجابات الفورية' },
    ],
    keyPlaceholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    hasFreeTier: true,
    requiresKey: true,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3 (Chat)', description: 'أداء ممتاز واقتصادي للتحليلات العامة' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Reasoner)', description: 'تفكير استنتاجي عميق وحسابات دقيقة' },
    ],
    keyPlaceholder: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    hasFreeTier: false,
    requiresKey: true,
  },
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  provider?: AIProvider;
  model?: string;
  metadata?: {
    technicalAnalysis?: CoinTechnicalAnalysis;
    newsArticles?: NewsArticle[];
    errorType?: 'quota_exceeded' | 'invalid_key' | 'rate_limit' | 'network_error';
  };
}

export interface CoinTechnicalAnalysis {
  symbol: string;
  interval: string;
  lastPrice: number;
  high24h: number;
  low24h: number;
  change24h: number;
  volume24h: number;
  rsi: number;
  ema9: number;
  ema20: number;
  ema50: number;
  ema200?: number;
  trend: 'صاعد' | 'هابط' | 'عرضي';
  rsiCondition: 'تشبع شرائي' | 'تشبع بيعي' | 'منطقة محايدة';
  supportLevels: number[];
  resistanceLevels: number[];
  pivotPoint: number;
  volumeStatus: 'أعلى من المتوسط' | 'طبيعي' | 'منخفض';
  source: string;
  updatedAt: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

export interface AssistantUserSettings {
  activeProvider: AIProvider;
  activeModel: string;
  // In-Memory only keys dictionary (never saved to localStorage)
  apiKeys: Partial<Record<AIProvider, string>>;
}
