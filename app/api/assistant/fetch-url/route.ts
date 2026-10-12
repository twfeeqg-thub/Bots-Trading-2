import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'الرابط غير صالح' }, { status: 400 });
    }

    const trimmedUrl = url.trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      return NextResponse.json({ error: 'صيغة الرابط غير صحيحة، تأكد من كتابة http:// أو https://' }, { status: 400 });
    }

    // SSRF protection
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'يُسمح فقط بروابط http و https' }, { status: 400 });
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    ) {
      return NextResponse.json({ error: 'لا يمكن جلب الروابط الداخلية' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(trimmedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      return NextResponse.json(
        { error: `تعذر جلب محتوى الرابط (رمز الاستجابة: ${res.status})` },
        { status: 400 }
      );
    }

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

    // Clean body text
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    return NextResponse.json({
      success: true,
      url: trimmedUrl,
      title: title || parsedUrl.hostname,
      snippet: cleanText || 'لم يتوفر نص مباشر من الصفحة.',
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'استغرق جلب الرابط وقتًا أطول من المتوقع (انتهت المهلة).' }, { status: 408 });
    }
    return NextResponse.json(
      { error: `تعذر الوصول إلى الرابط: ${err?.message || 'خطأ اتصال'}` },
      { status: 500 }
    );
  }
}
