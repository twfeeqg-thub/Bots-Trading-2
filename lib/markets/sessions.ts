// Project Q — Global Markets & Trading Sessions Engine
// Reference Time: Yemen / Saudi Arabia / Mecca (UTC+3)

export interface MarketSession {
  id: 'sydney' | 'tokyo' | 'london' | 'newyork';
  nameAr: string;
  nameEn: string;
  city: string;
  flag: string;
  startHourUtc3: number; // in UTC+3 (0-23)
  endHourUtc3: number;   // in UTC+3 (0-23)
  durationHours: number;
  liquidityLevel: 'low' | 'medium' | 'high' | 'peak';
  liquidityLabelAr: string;
  colorTheme: {
    bgLight: string;
    bgDark: string;
    borderLight: string;
    borderDark: string;
    textLight: string;
    textDark: string;
    accent: string;
  };
  descriptionAr: string;
  tradingBehaviorAr: string;
}

export const MARKET_SESSIONS: MarketSession[] = [
  {
    id: 'sydney',
    nameAr: 'جلسة سيدني',
    nameEn: 'Sydney Session',
    city: 'Sydney',
    flag: '🇦🇺',
    startHourUtc3: 1,  // 01:00 AM UTC+3
    endHourUtc3: 10,   // 10:00 AM UTC+3
    durationHours: 9,
    liquidityLevel: 'low',
    liquidityLabelAr: 'سيولة ضعيفة',
    colorTheme: {
      bgLight: 'bg-sky-50',
      bgDark: 'bg-sky-950/30',
      borderLight: 'border-sky-200',
      borderDark: 'border-sky-800/60',
      textLight: 'text-sky-800',
      textDark: 'text-sky-300',
      accent: '#0284c7',
    },
    descriptionAr: 'أول جلسة تفتح في اليوم التداولي الجديد، وتتميز بهدوء نسبي في السيولة.',
    tradingBehaviorAr: 'هدوء نسبي؛ غالباً ما تشهد الأسعار تحركات ضيقة ما لم تصدر أخبار مفاجئة.',
  },
  {
    id: 'tokyo',
    nameAr: 'الجلسة الآسيوية (طوكيو)',
    nameEn: 'Tokyo / Asian Session',
    city: 'Tokyo',
    flag: '🇯🇵',
    startHourUtc3: 3,  // 03:00 AM UTC+3
    endHourUtc3: 12,   // 12:00 PM (Noon) UTC+3
    durationHours: 9,
    liquidityLevel: 'medium',
    liquidityLabelAr: 'سيولة متوسطة',
    colorTheme: {
      bgLight: 'bg-violet-50',
      bgDark: 'bg-violet-950/30',
      borderLight: 'border-violet-200',
      borderDark: 'border-violet-800/60',
      textLight: 'text-violet-800',
      textDark: 'text-violet-300',
      accent: '#8b5cf6',
    },
    descriptionAr: 'تضم طوكيو وهونغ كونغ وسنغافورة وشنغهاي؛ تشهد تكوين نطاق تجميعي أسيوي (Asian Range).',
    tradingBehaviorAr: 'فترة تذبذب وتجميع أسعار؛ عادةً ما يمثل قاعها أو قمتها أهدافاً للسيولة في جلسة لندن.',
  },
  {
    id: 'london',
    nameAr: 'الجلسة الأوروبية (لندن)',
    nameEn: 'London / European Session',
    city: 'London',
    flag: '🇬🇧',
    startHourUtc3: 11, // 11:00 AM UTC+3
    endHourUtc3: 20,   // 08:00 PM UTC+3
    durationHours: 9,
    liquidityLevel: 'high',
    liquidityLabelAr: 'سيولة عالية ونشطة',
    colorTheme: {
      bgLight: 'bg-blue-50',
      bgDark: 'bg-blue-950/30',
      borderLight: 'border-blue-200',
      borderDark: 'border-blue-800/60',
      textLight: 'text-blue-800',
      textDark: 'text-blue-300',
      accent: '#3b82f6',
    },
    descriptionAr: 'دخول البنوك وصناديق الاستثمار الأوروبية، وبداية السيولة المؤسساتية القوية.',
    tradingBehaviorAr: 'كسر نطاق آسيا وبدء الاتجاهات الصاعدة الحقيقية، واختبار مستويات السيولة العميقة.',
  },
  {
    id: 'newyork',
    nameAr: 'الجلسة الأمريكية (نيويورك)',
    nameEn: 'New York Session',
    city: 'New York',
    flag: '🇺🇸',
    startHourUtc3: 16, // 04:00 PM UTC+3
    endHourUtc3: 1,    // 01:00 AM (Next Day) UTC+3
    durationHours: 9,
    liquidityLevel: 'peak',
    liquidityLabelAr: 'ذروة السيولة العالمية',
    colorTheme: {
      bgLight: 'bg-emerald-50',
      bgDark: 'bg-emerald-950/30',
      borderLight: 'border-emerald-200',
      borderDark: 'border-emerald-800/60',
      textLight: 'text-emerald-800',
      textDark: 'text-emerald-300',
      accent: '#10b981',
    },
    descriptionAr: 'وول ستريت وتدفق أموال المؤسسات وصناديق البيتكوين ETF في أمريكا.',
    tradingBehaviorAr: 'أعلى زخم وتقلب؛ أفضل وقت لصفقات الزخم الصاعد والاختراقات الحقيقية ذات السيولة الضخمة.',
  },
];

export interface OverlapWindow {
  id: 'tokyo-london' | 'london-newyork';
  nameAr: string;
  startHourUtc3: number;
  endHourUtc3: number;
  importanceAr: string;
  isPeak: boolean;
  descriptionAr: string;
}

export const OVERLAP_WINDOWS: OverlapWindow[] = [
  {
    id: 'tokyo-london',
    nameAr: 'تداخل طوكيو + لندن',
    startHourUtc3: 10, // 10:00 AM UTC+3
    endHourUtc3: 11,   // 11:00 AM UTC+3
    importanceAr: 'تقلبات جيدة وبدء التسخين الأوروبي',
    isPeak: false,
    descriptionAr: 'ساعة انتقالية بين نهاية آسيا وبداية أوروبا، تشهد حركات تجميعية وتسارع في الأوامر.',
  },
  {
    id: 'london-newyork',
    nameAr: 'تداخل لندن + نيويورك (النافذة الذهبية)',
    startHourUtc3: 16, // 04:00 PM UTC+3
    endHourUtc3: 20,   // 08:00 PM UTC+3
    importanceAr: 'الأقوى والأكثر نشاطاً في العالم (ذروة السيولة)',
    isPeak: true,
    descriptionAr: 'تزامن عمالقة أوروبا وأمريكا؛ أضيق فروقات سعرية، وأعلى أحجام تداول، وأقوى اختراقات صادقة.',
  },
];

export interface SessionStatusResult {
  session: MarketSession;
  isOpen: boolean;
  progressPercent: number; // 0 to 100
  timeUntilOpenMin: number;
  timeUntilCloseMin: number;
}

/**
 * Returns current time normalized to UTC+3 (Yemen / Saudi / Mecca)
 */
export function getCurrentTimeUtc3(date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  totalMinutesOfDay: number;
  formattedTime: string;
  formattedDate: string;
} {
  // Convert current UTC time to UTC+3
  const utcMilliseconds = date.getTime() + (date.getTimezoneOffset() * 60000);
  const utc3Time = new Date(utcMilliseconds + (3 * 3600000));

  const hours = utc3Time.getHours();
  const minutes = utc3Time.getMinutes();
  const seconds = utc3Time.getSeconds();
  const dayOfWeek = utc3Time.getDay();
  const totalMinutesOfDay = (hours * 60) + minutes;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const formattedDate = utc3Time.toLocaleDateString('ar-YE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    hours,
    minutes,
    seconds,
    dayOfWeek,
    totalMinutesOfDay,
    formattedTime,
    formattedDate,
  };
}

/**
 * Calculates current status for a given session
 */
export function calculateSessionStatus(
  session: MarketSession,
  currentMinutesOfDay: number
): SessionStatusResult {
  const startMin = session.startHourUtc3 * 60;
  const durationMin = session.durationHours * 60;
  
  let isOpen = false;
  let elapsedMin = 0;
  let timeUntilOpenMin = 0;
  let timeUntilCloseMin = 0;

  if (session.startHourUtc3 < session.endHourUtc3) {
    // Session does NOT cross midnight (e.g. 03:00 to 12:00 or 11:00 to 20:00)
    const endMin = session.endHourUtc3 * 60;
    if (currentMinutesOfDay >= startMin && currentMinutesOfDay < endMin) {
      isOpen = true;
      elapsedMin = currentMinutesOfDay - startMin;
      timeUntilCloseMin = endMin - currentMinutesOfDay;
    } else {
      isOpen = false;
      if (currentMinutesOfDay < startMin) {
        timeUntilOpenMin = startMin - currentMinutesOfDay;
      } else {
        timeUntilOpenMin = (1440 - currentMinutesOfDay) + startMin;
      }
    }
  } else {
    // Session crosses midnight (e.g. 16:00 to 01:00)
    const endMin = session.endHourUtc3 * 60;
    if (currentMinutesOfDay >= startMin || currentMinutesOfDay < endMin) {
      isOpen = true;
      if (currentMinutesOfDay >= startMin) {
        elapsedMin = currentMinutesOfDay - startMin;
      } else {
        elapsedMin = (1440 - startMin) + currentMinutesOfDay;
      }
      timeUntilCloseMin = durationMin - elapsedMin;
    } else {
      isOpen = false;
      timeUntilOpenMin = startMin - currentMinutesOfDay;
    }
  }

  const progressPercent = isOpen
    ? Math.min(100, Math.max(0, Math.round((elapsedMin / durationMin) * 100)))
    : 0;

  return {
    session,
    isOpen,
    progressPercent,
    timeUntilOpenMin,
    timeUntilCloseMin,
  };
}

/**
 * Checks if current time is within CME maintenance window:
 * CME halts 1 hour each week: Sunday 22:00 - 23:00 UTC = Monday 01:00 - 02:00 AM (UTC+3)
 */
export function getCmeStatus(utc3: ReturnType<typeof getCurrentTimeUtc3>): {
  isMaintenance: boolean;
  messageAr: string;
  isUpcomingSoon: boolean;
} {
  // Monday is dayOfWeek === 1
  const isMonday = utc3.dayOfWeek === 1;
  const isMaintenanceHour = isMonday && utc3.hours === 1; // 01:00 to 01:59 AM UTC+3

  // Is within 3 hours prior (Sunday 22:00 - 23:59 UTC+3)
  const isSundayNight = utc3.dayOfWeek === 0 && utc3.hours >= 22;

  if (isMaintenanceHour) {
    return {
      isMaintenance: true,
      messageAr: 'CME في نافذة الصيانة الأسبوعية المجدولة حالياً (تستأنف 02:00 ص)',
      isUpcomingSoon: false,
    };
  }

  if (isSundayNight) {
    return {
      isMaintenance: false,
      messageAr: 'تنبيه: نافذة صيانة CME ستبدأ الليلة في تمام 01:00 ص وتستمر لساعة واحدة',
      isUpcomingSoon: true,
    };
  }

  return {
    isMaintenance: false,
    messageAr: 'تداول CME مستمر على مدار 24/7 (سيولة العقود المنظمة نشطة)',
    isUpcomingSoon: false,
  };
}

/**
 * Formats minutes into human-readable Arabic string (e.g. 2 س و 15 د)
 */
export function formatMinutesAr(minutes: number): string {
  if (minutes <= 0) return 'الآن';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0 && m > 0) return `${h} س و ${m} د`;
  if (h > 0) return `${h} ساعة`;
  return `${m} دقيقة`;
}
