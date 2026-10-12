import { NextRequest, NextResponse } from 'next/server';

interface ModelsRequestPayload {
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'openrouter' | 'mistral';
  customApiKey?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ModelsRequestPayload = await req.json();
    const { provider, customApiKey } = body;

    if (!provider) {
      return NextResponse.json({ error: 'لم يتم تحديد المزود' }, { status: 400 });
    }

    // 1. GEMINI
    if (provider === 'gemini') {
      const apiKey = customApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'يرجى إدخال مفتاح Gemini API أولاً للاستعلام عن النماذج المتاحة.' },
          { status: 400 }
        );
      }

      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `فشل الاستعلام من Google Gemini (رمز: ${res.status})`;
          if (res.status === 400 || res.status === 401) {
            return NextResponse.json({ error: 'مفتاح Gemini API غير صالح أو غير مصرح له.' }, { status: 401 });
          }
          return NextResponse.json({ error: errMsg }, { status: res.status });
        }

        const data = await res.json();
        const rawModels: any[] = data.models || [];

        // Filter models that support content generation
        const filtered = rawModels
          .filter((m) => {
            const methods = m.supportedGenerationMethods || [];
            return methods.includes('generateContent');
          })
          .map((m) => {
            const modelId = m.name.replace(/^models\//, '');
            return {
              id: modelId,
              name: m.displayName || modelId,
              description: m.description || 'نموذج توليد نصوص وتحليلات من Google Gemini',
              isDynamic: true,
            };
          });

        if (filtered.length === 0) {
          return NextResponse.json({ error: 'لم يتم العثور على نماذج تدعم المحادثة في حساب Gemini هذا.' }, { status: 404 });
        }

        return NextResponse.json({
          provider: 'gemini',
          count: filtered.length,
          models: filtered,
        });
      } catch (err: any) {
        return NextResponse.json({ error: `تعذر الاتصال بـ Google Gemini API: ${err?.message || ''}` }, { status: 500 });
      }
    }

    // 2. GROQ
    if (provider === 'groq') {
      const apiKey = customApiKey || process.env.GROQ_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'يرجى إدخال مفتاح Groq API المجاني أولاً في حقل المفتاح للاستعلام عن النماذج المتاحة.' },
          { status: 400 }
        );
      }

      try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401) {
            return NextResponse.json({ error: 'مفتاح Groq API غير صالح أو منتهي الصلاحية.' }, { status: 401 });
          }
          return NextResponse.json(
            { error: errData?.error?.message || `فشل الاستعلام من Groq API (رمز: ${res.status})` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const rawList: any[] = data.data || [];

        // Exclude audio/whisper/embeddings, focus on active LLM models
        const filtered = rawList
          .filter((m) => {
            const id = (m.id || '').toLowerCase();
            return !id.includes('whisper') && !id.includes('guard') && m.active !== false;
          })
          .sort((a, b) => (b.created || 0) - (a.created || 0))
          .map((m) => ({
            id: m.id,
            name: m.id,
            description: `نموذج نشط من Groq (سياق: ${m.context_window ? `${m.context_window} رمز` : 'قياسي'})`,
            isDynamic: true,
          }));

        if (filtered.length === 0) {
          return NextResponse.json({ error: 'لم يُرجع Groq أي نماذج نشطة صالحة.' }, { status: 404 });
        }

        return NextResponse.json({
          provider: 'groq',
          count: filtered.length,
          models: filtered,
        });
      } catch (err: any) {
        return NextResponse.json({ error: `تعذر الاتصال بـ Groq API: ${err?.message || ''}` }, { status: 500 });
      }
    }

    // 3. OPENAI
    if (provider === 'openai') {
      const apiKey = customApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'يرجى إدخال مفتاح OpenAI API أولاً للاستعلام عن النماذج المتاحة.' },
          { status: 400 }
        );
      }

      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401) {
            return NextResponse.json({ error: 'مفتاح OpenAI API غير صالح.' }, { status: 401 });
          }
          return NextResponse.json(
            { error: errData?.error?.message || `فشل الاستعلام من OpenAI (رمز: ${res.status})` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const rawList: any[] = data.data || [];

        // Filter to chat models
        const filtered = rawList
          .filter((m) => {
            const id = (m.id || '').toLowerCase();
            return (
              (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt')) &&
              !id.includes('realtime') &&
              !id.includes('audio') &&
              !id.includes('transcription')
            );
          })
          .sort((a, b) => (b.created || 0) - (a.created || 0))
          .map((m) => ({
            id: m.id,
            name: m.id,
            description: `نموذج رسمي من OpenAI (${m.owned_by || 'system'})`,
            isDynamic: true,
          }));

        return NextResponse.json({
          provider: 'openai',
          count: filtered.length,
          models: filtered,
        });
      } catch (err: any) {
        return NextResponse.json({ error: `تعذر الاتصال بـ OpenAI API: ${err?.message || ''}` }, { status: 500 });
      }
    }

    // 4. ANTHROPIC
    if (provider === 'anthropic') {
      const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'يرجى إدخال مفتاح Anthropic API أولاً للاستعلام عن النماذج المتاحة.' },
          { status: 400 }
        );
      }

      try {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401) {
            return NextResponse.json({ error: 'مفتاح Anthropic API غير صالح.' }, { status: 401 });
          }
          return NextResponse.json(
            { error: errData?.error?.message || `فشل الاستعلام من Anthropic (رمز: ${res.status})` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const rawList: any[] = data.data || [];
        const filtered = rawList.map((m) => ({
          id: m.id,
          name: m.display_name || m.id,
          description: `نموذج رسمي من Anthropic Claude`,
          isDynamic: true,
        }));

        return NextResponse.json({
          provider: 'anthropic',
          count: filtered.length,
          models: filtered,
        });
      } catch (err: any) {
        return NextResponse.json({ error: `تعذر الاتصال بـ Anthropic API: ${err?.message || ''}` }, { status: 500 });
      }
    }

    // 5. DEEPSEEK
    if (provider === 'deepseek') {
      const apiKey = customApiKey || process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'يرجى إدخال مفتاح DeepSeek API أولاً للاستعلام عن النماذج المتاحة.' },
          { status: 400 }
        );
      }

      try {
        const res = await fetch('https://api.deepseek.com/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401) {
            return NextResponse.json({ error: 'مفتاح DeepSeek API غير صالح.' }, { status: 401 });
          }
          return NextResponse.json(
            { error: errData?.error?.message || `فشل الاستعلام من DeepSeek (رمز: ${res.status})` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const rawList: any[] = data.data || [];
        const filtered = rawList.map((m) => ({
          id: m.id,
          name: m.id,
          description: `نموذج رسمي من عائلة DeepSeek`,
          isDynamic: true,
        }));

        return NextResponse.json({
          provider: 'deepseek',
          count: filtered.length,
          models: filtered,
        });
      } catch (err: any) {
        return NextResponse.json({ error: `تعذر الاتصال بـ DeepSeek API: ${err?.message || ''}` }, { status: 500 });
      }
    }

    // 6. OPENROUTER
    if (provider === 'openrouter') {
      const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      try {
        const res = await fetch('https://openrouter.ai/api/v1/models', { headers });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return NextResponse.json(
            { error: errData?.error?.message || `فشل الاستعلام من OpenRouter (رمز: ${res.status})` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const rawList: any[] = data.data || [];

        // Prioritize free models (:free) and popular models
        const freeModels = rawList.filter((m) => m.id.endsWith(':free') || m.pricing?.prompt === '0');
        const otherModels = rawList.filter((m) => !m.id.endsWith(':free') && m.pricing?.prompt !== '0');

        const combined = [...freeModels, ...otherModels.slice(0, 30)];

        const filtered = combined.map((m) => {
          const isFree = m.id.endsWith(':free') || m.pricing?.prompt === '0';
          return {
            id: m.id,
            name: `${m.name || m.id}${isFree ? ' (مجاني / Free)' : ''}`,
            description: m.description ? m.description.slice(0, 120) + '...' : `نموذج متاح عبر OpenRouter${isFree ? ' (فئة مجانية)' : ''}`,
            contextWindow: m.context_length ? `${m.context_length} رمز` : undefined,
            isDynamic: true,
            isFree,
          };
        });

        if (filtered.length === 0) {
          return NextResponse.json({ error: 'لم يُرجع OpenRouter أي نماذج صالحة.' }, { status: 404 });
        }

        return NextResponse.json({
          provider: 'openrouter',
          count: filtered.length,
          models: filtered,
        });
      } catch (err: any) {
        return NextResponse.json({ error: `تعذر الاتصال بـ OpenRouter API: ${err?.message || ''}` }, { status: 500 });
      }
    }

    // 7. MISTRAL AI
    if (provider === 'mistral') {
      const apiKey = customApiKey || process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'يرجى إدخال مفتاح Mistral API أولاً في حقل المفتاح للاستعلام عن النماذج المتاحة.' },
          { status: 400 }
        );
      }

      try {
        const res = await fetch('https://api.mistral.ai/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 401) {
            return NextResponse.json({ error: 'مفتاح Mistral API غير صالح.' }, { status: 401 });
          }
          return NextResponse.json(
            { error: errData?.error?.message || `فشل الاستعلام من Mistral API (رمز: ${res.status})` },
            { status: res.status }
          );
        }

        const data = await res.json();
        const rawList: any[] = data.data || [];
        const filtered = rawList
          .filter((m) => !m.id.includes('embed'))
          .map((m) => ({
            id: m.id,
            name: m.name || m.id,
            description: m.description || `نموذج رسمي من Mistral AI`,
            isDynamic: true,
          }));

        if (filtered.length === 0) {
          return NextResponse.json({ error: 'لم يُرجع Mistral API أي نماذج صالحة.' }, { status: 404 });
        }

        return NextResponse.json({
          provider: 'mistral',
          count: filtered.length,
          models: filtered,
        });
      } catch (err: any) {
        return NextResponse.json({ error: `تعذر الاتصال بـ Mistral API: ${err?.message || ''}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'مزود غير مدعوم' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء معالجة طلب جلب النماذج' },
      { status: 500 }
    );
  }
}
