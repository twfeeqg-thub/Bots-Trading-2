import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface ChatRequestPayload {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek';
  model?: string;
  customApiKey?: string;
  marketContext?: any;
  newsContext?: any[];
}

const SYSTEM_INSTRUCTION = `أنت المساعد الذكي المستقل لتحليل العملات والأسواق في تطبيق «بوت(٢) مراقبة صعود العملات - مشروع Q».

قواعدك الصارمة:
1. استقلال التداول: أنت مساعد تحليلي وفني واستشاري فقط. لا تملك أي صلاحية لتنفيذ صفقات شراء أو بيع، ولا تغيّر إعدادات البوتات أو مدير الصفقات. إذا طُلب منك الشراء أو البيع، وضّح بأدب أنك مخصص للتحليل والاستشارة الفنية فقط وأن قرارات التداول تُدار يدويًا عبر شاشة «التداول الموحد».
2. دقة الأرقام: اعتمد كليًا على بيانات السوق الحية المرفقة في سياق الحديث (الأسعار الحالية، المتوسطات EMA، مؤشر RSI، ومستويات الدعم والمقاومة). لا تخترع أسعارًا أو مستويات وهمية.
3. التوثيق: اذكر دائمًا وقت التحديث والمصدر (مثل Binance Spot Live API) عند تقديم تحليل رقمي.
4. الأخبار: عند الإشارة إلى الأخبار المرفقة، اذكر اسم المصدر وتاريخ النشر والرابط إن وُجد.
5. الأسلوب: تحدث باللغة العربية الفصحى بأسلوب مهني، مباشر، مرتب، وواضح باستخدام التنسيق (نقاط، خط عريض، جداول مختصرة).`;

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestPayload = await req.json();
    const { messages, provider = 'gemini', model, customApiKey, marketContext, newsContext } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'قائمة الرسائل فارغة' }, { status: 400 });
    }

    // Build context augmentations
    let contextPrompt = '';
    if (marketContext) {
      contextPrompt += `\n[بيانات السوق الفنية الحية المحدثة للعملة ${marketContext.symbol} بإطار ${marketContext.interval}]:
- السعر الحالي: ${marketContext.lastPrice} USDT
- أعلى سعر 24 ساعة: ${marketContext.high24h} | أدنى سعر: ${marketContext.low24h}
- التغير: ${marketContext.change24h}%
- مؤشر القوة النسبية RSI(14): ${marketContext.rsi} (${marketContext.rsiCondition})
- المتوسطات المتحركة: EMA9=${marketContext.ema9}, EMA20=${marketContext.ema20}, EMA50=${marketContext.ema50}${marketContext.ema200 ? `, EMA200=${marketContext.ema200}` : ''}
- الاتجاه الفني الحالي: ${marketContext.trend}
- نقطة الارتكاز Pivot: ${marketContext.pivotPoint}
- مستويات الدعم: S1=${marketContext.supportLevels?.[0]}, S2=${marketContext.supportLevels?.[1]}
- مستويات المقاومة: R1=${marketContext.resistanceLevels?.[0]}, R2=${marketContext.resistanceLevels?.[1]}
- حالة حجم التداول: ${marketContext.volumeStatus}
- المصدر: ${marketContext.source} | وقت الجلب: ${marketContext.updatedAt}\n`;
    }

    if (newsContext && Array.isArray(newsContext) && newsContext.length > 0) {
      contextPrompt += `\n[أحدث أخبار العملات والأسواق المجمعة من خلاصات الأخبار]:\n`;
      newsContext.slice(0, 5).forEach((item, idx) => {
        contextPrompt += `${idx + 1}. "${item.title}" - المصدر: ${item.source} (${item.publishedAt}) | الرابط: ${item.link}\n`;
      });
    }

    // Append context to the last user message or system instruction
    const formattedMessages = messages.map((m, idx) => {
      if (idx === messages.length - 1 && m.role === 'user' && contextPrompt) {
        return {
          role: m.role,
          content: `${m.content}\n\n${contextPrompt}`,
        };
      }
      return m;
    });

    // 1. GEMINI PROVIDER
    if (provider === 'gemini') {
      const apiKey = customApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            errorType: 'invalid_key',
            error: 'مفتاح Gemini API غير متوفر. يرجى إدخال مفتاحك في إعدادات المساعد.',
          },
          { status: 401 }
        );
      }

      const selectedModel = model || 'gemini-2.5-flash';
      const ai = new GoogleGenAI({ apiKey });

      try {
        const contents = formattedMessages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        }));

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });

        const reply = response.text || 'لا توجد استجابة من النموذج.';
        return NextResponse.json({
          reply,
          provider: 'gemini',
          model: selectedModel,
        });
      } catch (err: any) {
        const errMsg = err?.message || '';
        const status = err?.status || 500;
        if (status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'تم تجاوز حصة الاستخدام (Rate Limit / Quota) لنموذج Gemini. يمكنك التبديل إلى نموذج أو مزود آخر.',
            },
            { status: 429 }
          );
        }
        if (status === 400 || status === 401 || errMsg.includes('API key not valid')) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح Gemini API غير صالح أو انتهت صلاحيته.',
            },
            { status: 401 }
          );
        }
        throw err;
      }
    }

    // 2. OPENAI PROVIDER
    if (provider === 'openai') {
      const apiKey = customApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            errorType: 'invalid_key',
            error: 'يرجى إدخال مفتاح OpenAI API في إعدادات المساعد.',
          },
          { status: 401 }
        );
      }

      const selectedModel = model || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            ...formattedMessages,
          ],
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 429 || errJson?.error?.code === 'insufficient_quota') {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'نفدت حصة OpenAI أو تم تجاوز حد الطلبات. يمكنك التبديل لمزود آخر بنقرة واحدة.',
            },
            { status: 429 }
          );
        }
        if (res.status === 401) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح OpenAI API غير صالح.',
            },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: errJson?.error?.message || 'فشل الاتصال بـ OpenAI' },
          { status: res.status }
        );
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return NextResponse.json({ reply, provider: 'openai', model: selectedModel });
    }

    // 3. ANTHROPIC CLAUDE PROVIDER
    if (provider === 'anthropic') {
      const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            errorType: 'invalid_key',
            error: 'يرجى إدخال مفتاح Anthropic API في إعدادات المساعد.',
          },
          { status: 401 }
        );
      }

      const selectedModel = model || 'claude-3-5-haiku-20241022';
      // Convert messages to Claude structure (system in top-level param)
      const claudeMessages = formattedMessages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 2048,
          system: SYSTEM_INSTRUCTION,
          messages: claudeMessages,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 429) {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'تم تجاوز حد الاستخدام لـ Anthropic Claude.',
            },
            { status: 429 }
          );
        }
        if (res.status === 401) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح Anthropic API غير صالح.',
            },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: errJson?.error?.message || 'فشل الاتصال بـ Anthropic' },
          { status: res.status }
        );
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text || '';
      return NextResponse.json({ reply, provider: 'anthropic', model: selectedModel });
    }

    // 4. GROQ PROVIDER
    if (provider === 'groq') {
      const apiKey = customApiKey || process.env.GROQ_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            errorType: 'invalid_key',
            error: 'يرجى إدخال مفتاح Groq API المجاني في إعدادات المساعد.',
          },
          { status: 401 }
        );
      }

      const selectedModel = model || 'llama-3.3-70b-versatile';
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            ...formattedMessages,
          ],
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 429) {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'تم تجاوز معدل طلبات Groq المجانية. يمكنك التبديل لمزود آخر.',
            },
            { status: 429 }
          );
        }
        if (res.status === 401) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح Groq API غير صالح.',
            },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: errJson?.error?.message || 'فشل الاتصال بـ Groq' },
          { status: res.status }
        );
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return NextResponse.json({ reply, provider: 'groq', model: selectedModel });
    }

    // 5. DEEPSEEK PROVIDER
    if (provider === 'deepseek') {
      const apiKey = customApiKey || process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            errorType: 'invalid_key',
            error: 'يرجى إدخال مفتاح DeepSeek API في إعدادات المساعد.',
          },
          { status: 401 }
        );
      }

      const selectedModel = model || 'deepseek-chat';
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            ...formattedMessages,
          ],
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 429 || errJson?.error?.code === 'insufficient_quota') {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'نفدت حصة DeepSeek أو تم تجاوز حد الطلبات.',
            },
            { status: 429 }
          );
        }
        if (res.status === 401) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح DeepSeek API غير صالح.',
            },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: errJson?.error?.message || 'فشل الاتصال بـ DeepSeek' },
          { status: res.status }
        );
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return NextResponse.json({ reply, provider: 'deepseek', model: selectedModel });
    }

    return NextResponse.json({ error: `مزود غير مدعوم: ${provider}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب' },
      { status: 500 }
    );
  }
}
