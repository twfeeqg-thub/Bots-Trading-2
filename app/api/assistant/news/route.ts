import { NextRequest, NextResponse } from 'next/server';

interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

const RSS_FEEDS = [
  {
    name: 'Google News Crypto',
    url: 'https://news.google.com/rss/search?q=cryptocurrency+bitcoin+ethereum&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
  },
];

// Clean HTML tags and decode entities
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseRSS(xmlText: string, defaultSource: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null && items.length < 10) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const linkMatch = itemContent.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i);
    const pubDateMatch = itemContent.match(/<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i);
    const descMatch =
      itemContent.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i) ||
      itemContent.match(/<content:encoded\b[^>]*>([\s\S]*?)<\/content:encoded>/i);
    const sourceMatch = itemContent.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i);

    const title = cleanText(titleMatch ? titleMatch[1] : '');
    const link = linkMatch ? linkMatch[1].trim() : '';
    const rawDate = pubDateMatch ? pubDateMatch[1].trim() : '';
    const snippet = cleanText(descMatch ? descMatch[1] : '').slice(0, 180);
    const source = sourceMatch ? cleanText(sourceMatch[1]) : defaultSource;

    if (title && link) {
      let formattedDate = rawDate;
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleString('ar-SA', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      } catch {
        // keep rawDate
      }

      items.push({
        id: `${link}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        link,
        source: source || defaultSource,
        publishedAt: formattedDate,
        snippet: snippet ? `${snippet}...` : '',
      });
    }
  }

  return items;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  const allArticles: NewsItem[] = [];

  for (const feed of RSS_FEEDS) {
    try {
      const feedUrl = query
        ? `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' crypto')}&hl=en-US&gl=US&ceid=US:en`
        : feed.url;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml',
          'User-Agent': 'Mozilla/5.0 (compatible; CryptoAssistantNews/1.0)',
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        const parsed = parseRSS(text, feed.name);
        allArticles.push(...parsed);
        if (allArticles.length >= 12) break;
      }
    } catch {
      // Continue to next feed if one fails or times out
      continue;
    }
  }

  // Deduplicate by title similarity
  const seenTitles = new Set<string>();
  const uniqueArticles = allArticles.filter((item) => {
    const normalized = item.title.toLowerCase().slice(0, 30);
    if (seenTitles.has(normalized)) return false;
    seenTitles.add(normalized);
    return true;
  });

  return NextResponse.json(
    {
      articles: uniqueArticles.slice(0, 10),
      count: uniqueArticles.length,
      updatedAt: new Date().toLocaleTimeString('ar-SA', { hour12: false }),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  );
}
