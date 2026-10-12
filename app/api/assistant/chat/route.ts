import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface ChatRequestPayload {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'mistral';
  model?: string;
  customApiKey?: string;
  marketContext?: any;
  newsContext?: any[];
  attachments?: Array<{
    id: string;
    type: 'image' | 'file' | 'text' | 'link';
    name: string;
    url?: string;
    mimeType?: string;
    size?: number;
    content?: string;
  }>;
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
    const { messages, provider = 'gemini', model, customApiKey, marketContext, newsContext, attachments } = body;

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

    // Process attachments context
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      contextPrompt += `\n[مرفقات مرسلة من المستخدم مع هذه الرسالة]:\n`;
      attachments.forEach((att, idx) => {
        if (att.type === 'file') {
          contextPrompt += `- مرفق ملف (${idx + 1}): "${att.name}"${att.size ? ` (${(att.size / 1024).toFixed(1)} KB)` : ''}\n`;
          if (att.content) {
            contextPrompt += `محتوى الملف:\n"""\n${att.content.slice(0, 8000)}\n"""\n`;
          }
        } else if (att.type === 'link') {
          contextPrompt += `- مرفق رابط (${idx + 1}): "${att.name || att.url}" | الرابط: ${att.url || att.content}\n`;
          if (att.content && att.content !== att.url) {
            contextPrompt += `محتوى أو تفاصيل الرابط:\n"""\n${att.content.slice(0, 4000)}\n"""\n`;
          }
        } else if (att.type === 'text') {
          contextPrompt += `- مرفق نص مقتبس (${idx + 1}): "${att.name}"\n"""\n${(att.content || '').slice(0, 8000)}\n"""\n`;
        } else if (att.type === 'image') {
          contextPrompt += `- مرفق صورة (${idx + 1}): "${att.name}"${att.size ? ` (${(att.size / 1024).toFixed(1)} KB)` : ''} (تم إرفاقها للفحص الفني / البصري).\n`;
        }
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
        const imageAttachments = (attachments || []).filter(
          (a) => a.type === 'image' && a.content && a.content.startsWith('data:')
        );

        const contents = formattedMessages.map((msg, idx) => {
          const parts: any[] = [{ text: msg.content }];
          // Attach image inlineData to last user message if available
          if (idx === formattedMessages.length - 1 && msg.role === 'user' && imageAttachments.length > 0) {
            for (const img of imageAttachments) {
              const metaPart = img.content!.split(',')[0];
              const base64Data = img.content!.split(',')[1];
              const mimeType = metaPart.split(';')[0].replace('data:', '') || 'image/jpeg';
              if (base64Data) {
                parts.push({
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                });
              }
            }
          }
          return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts,
          };
        });

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
        const status = err?.status || (err?.code ? Number(err.code) : 500);

        if (
          status === 404 ||
          errMsg.includes('not found') ||
          errMsg.includes('NotFound') ||
          errMsg.includes('is not supported for this API version') ||
          errMsg.includes('models/')
        ) {
          return NextResponse.json(
            {
              errorType: 'model_not_found',
              error: `النموذج "${selectedModel}" غير متاح لدى Gemini حاليًا. يرجى الضغط على «تحديث النماذج المتاحة من المزود 🔄» في الإعدادات أو اختيار نموذج آخر مثل gemini-2.5-flash.`,
            },
            { status: 404 }
          );
        }
        if (status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'تم تجاوز حصة الاستخدام (Rate Limit / Quota) لنموذج Gemini. يمكنك التبديل إلى نموذج أو مزود آخر.',
            },
            { status: 429 }
          );
        }
        if (status === 400 || status === 401 || errMsg.includes('API key not valid') || errMsg.includes('API_KEY_INVALID')) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح Gemini API غير صالح أو غير مصرح له.',
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
        const errCode = errJson?.error?.code;
        const errMsg = errJson?.error?.message || '';

        if (res.status === 404 || errCode === 'model_not_found' || errMsg.includes('does not exist')) {
          return NextResponse.json(
            {
              errorType: 'model_not_found',
              error: `النموذج "${selectedModel}" غير موجود لدى OpenAI (model_not_found). يمكنك استخدام زر «تحديث النماذج المتاحة من المزود 🔄» لجلب النماذج المتاحة.`,
            },
            { status: 404 }
          );
        }
        if (res.status === 429 || errCode === 'insufficient_quota') {
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
          { error: errMsg || 'فشل الاتصال بـ OpenAI' },
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
        const errType = errJson?.error?.type;
        const errMsg = errJson?.error?.message || '';

        if (res.status === 404 || errType === 'not_found_error' || errMsg.includes('model')) {
          return NextResponse.json(
            {
              errorType: 'model_not_found',
              error: `النموذج "${selectedModel}" غير متاح لدى Anthropic Claude. يمكنك تحديث النماذج أو اختيار نموذج متاح.`,
            },
            { status: 404 }
          );
        }
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
          { error: errMsg || 'فشل الاتصال بـ Anthropic' },
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
        const errCode = errJson?.error?.code;
        const errMsg = errJson?.error?.message || '';

        // Exact Groq model_not_found diagnosis
        if (
          res.status === 404 ||
          errCode === 'model_not_found' ||
          errMsg.toLowerCase().includes('model_not_found') ||
          errMsg.toLowerCase().includes('model `') ||
          errMsg.toLowerCase().includes('model does not exist') ||
          errMsg.toLowerCase().includes('decommissioned')
        ) {
          return NextResponse.json(
            {
              errorType: 'model_not_found',
              error: `النموذج "${selectedModel}" غير متوفر لدى Groq (model_not_found). يرجى فتح الإعدادات والضغط على زر «تحديث النماذج المتاحة من المزود 🔄» لاختيار أحد النماذج النشطة حاليًا.`,
            },
            { status: 404 }
          );
        }
        if (res.status === 429) {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'تم تجاوز معدل طلبات Groq المجانية (Rate Limit). يمكنك التبديل لمزود آخر أو الانتظار دقيقة واحدة.',
            },
            { status: 429 }
          );
        }
        if (res.status === 401) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح Groq API غير صالح أو غير مصرح له.',
            },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: errMsg || 'فشل الاتصال بـ Groq' },
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
        const errCode = errJson?.error?.code;
        const errMsg = errJson?.error?.message || '';

        if (res.status === 404 || errCode === 'model_not_found' || errMsg.includes('model')) {
          return NextResponse.json(
            {
              errorType: 'model_not_found',
              error: `النموذج "${selectedModel}" غير متاح لدى DeepSeek. اضغط على «تحديث النماذج المتاحة من المزود 🔄» في الإعدادات لاختيار نموذج نشط.`,
            },
            { status: 404 }
          );
        }
        if (res.status === 429 || errCode === 'insufficient_quota') {
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
          { error: errMsg || 'فشل الاتصال بـ DeepSeek' },
          { status: res.status }
        );
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return NextResponse.json({ reply, provider: 'deepseek', model: selectedModel });
    }

    // 6. OPENROUTER PROVIDER
    if (provider === 'openrouter') {
      const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            errorType: 'invalid_key',
            error: 'يرجى إدخال مفتاح OpenRouter API في إعدادات المساعد.',
          },
          { status: 401 }
        );
      }

      const selectedModel = model || 'deepseek/deepseek-r1:free';
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://project-q.app',
          'X-Title': 'Project Q Assistant',
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
        const errCode = errJson?.error?.code;
        const errMsg = errJson?.error?.message || '';

        if (
          res.status === 404 ||
          errCode === 'model_not_found' ||
          errMsg.includes('model') ||
          errMsg.includes('not found') ||
          errMsg.includes('No available endpoints')
        ) {
          return NextResponse.json(
            {
              errorType: 'model_not_found',
              error: `النموذج "${selectedModel}" غير متاح لدى OpenRouter حاليًا. يرجى الضغط على «تحديث النماذج المتاحة من المزود 🔄» في الإعدادات أو اختيار نموذج آخر مثل deepseek/deepseek-r1:free.`,
            },
            { status: 404 }
          );
        }
        if (res.status === 429 || errCode === 'insufficient_quota' || errMsg.includes('rate-limited') || errMsg.includes('credit')) {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'تم تجاوز حد الطلبات أو نفاد الرصيد المجاني في OpenRouter. يمكنك التبديل لمزود أو نموذج مجاني آخر.',
            },
            { status: 429 }
          );
        }
        if (res.status === 401) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح OpenRouter API غير صالح أو غير مصرح له.',
            },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: errMsg || 'فشل الاتصال بـ OpenRouter' },
          { status: res.status }
        );
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return NextResponse.json({ reply, provider: 'openrouter', model: selectedModel });
    }

    // 7. MISTRAL AI PROVIDER
    if (provider === 'mistral') {
      const apiKey = customApiKey || process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          {
            errorType: 'invalid_key',
            error: 'يرجى إدخال مفتاح Mistral API في إعدادات المساعد.',
          },
          { status: 401 }
        );
      }

      const selectedModel = model || 'mistral-small-latest';
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
        const errMsg = errJson?.message || errJson?.error?.message || '';

        if (
          res.status === 404 ||
          errMsg.includes('model') ||
          errMsg.includes('not found')
        ) {
          return NextResponse.json(
            {
              errorType: 'model_not_found',
              error: `النموذج "${selectedModel}" غير متاح لدى Mistral AI حاليًا. اضغط على «تحديث النماذج المتاحة من المزود 🔄» في الإعدادات للاختيار من النماذج المتاحة.`,
            },
            { status: 404 }
          );
        }
        if (res.status === 429 || errMsg.includes('usage') || errMsg.includes('capacity')) {
          return NextResponse.json(
            {
              errorType: 'quota_exceeded',
              error: 'تم تجاوز حصة أو سعة الاستخدام لـ Mistral AI.',
            },
            { status: 429 }
          );
        }
        if (res.status === 401) {
          return NextResponse.json(
            {
              errorType: 'invalid_key',
              error: 'مفتاح Mistral API غير صالح.',
            },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: errMsg || 'فشل الاتصال بـ Mistral AI' },
          { status: res.status }
        );
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return NextResponse.json({ reply, provider: 'mistral', model: selectedModel });
    }

    return NextResponse.json({ error: `مزود غير مدعوم: ${provider}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب' },
      { status: 500 }
    );
  }
}
