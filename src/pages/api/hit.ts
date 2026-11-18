import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSessionUser, SESSION_COOKIE } from '../../lib/auth';

export const prerender = false;

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|curl|wget|python|monitor/i;
const EVENTS = ['view', 'call', 'zalo', 'messenger'];

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

function vnDay(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function sourceOf(referrer: string, ownHost: string): string {
  if (!referrer) return 'direct';
  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'direct';
  }
  if (!host) return 'direct';
  if (host === ownHost.replace(/^www\./, '')) return 'internal';
  if (/google\./.test(host)) return 'google';
  if (/bing\./.test(host)) return 'bing';
  if (/facebook\.|fb\.|messenger\./.test(host)) return 'facebook';
  if (/zalo\./.test(host)) return 'zalo';
  if (/tiktok\./.test(host)) return 'tiktok';
  if (/youtube\.|youtu\.be/.test(host)) return 'youtube';
  if (/instagram\./.test(host)) return 'instagram';
  return 'other';
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const done = () => new Response(null, { status: 204 });

  try {
    const ua = request.headers.get('user-agent') ?? '';
    if (!ua || BOT.test(ua)) return done();

    const token = cookies.get(SESSION_COOKIE)?.value;
    if (token && (await getSessionUser(token))) return done();

    const body = JSON.parse(await request.text()) as { t?: string; p?: string; r?: string };
    const event = String(body.t ?? '');
    if (!EVENTS.includes(event)) return done();

    let path = String(body.p ?? '').split('?')[0].split('#')[0].slice(0, 200);
    if (!path.startsWith('/')) return done();
    if (!path.endsWith('/')) path += '/';
    if (/^\/(admin|api|media)(\/|$)/.test(path)) return done();

    let productId: number | null = null;
    const m = path.match(/^\/san-pham\/([a-z0-9-]+)\/$/);
    if (m) {
      const product = await env.DB.prepare('SELECT id FROM products WHERE slug = ?')
        .bind(m[1])
        .first<{ id: number }>();
      if (!product) return done();
      productId = product.id;
    }

    const day = vnDay();
    const secret = String((env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET ?? '');
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const visitor = await sha256(`${ip}|${ua}|${day}|${secret}`);
    const source = sourceOf(String(body.r ?? ''), new URL(request.url).hostname);
    const device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';

    await env.DB.prepare(
      'INSERT INTO page_views (day, event, path, product_id, visitor, source, device) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(day, event, path, productId, visitor, source, device)
      .run();

    if (Math.random() < 0.01) {
      await env.DB.prepare("DELETE FROM page_views WHERE day < date('now', '-180 days')").run();
    }
  } catch {
    // Không để lỗi thống kê ảnh hưởng khách
  }

  return done();
};