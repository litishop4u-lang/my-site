import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

const KEY_RE = /^img\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$/i;

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await checkConnectorKey(request))) {
    return jsonResponse({ error: 'Sai khoá hoặc chưa có khoá.' }, 401);
  }

  const key = url.searchParams.get('k') ?? '';
  if (!KEY_RE.test(key)) return jsonResponse({ error: 'Ảnh không hợp lệ.' }, 400);

  const obj = await env.IMAGES_BUCKET.get(key);
  if (!obj) return jsonResponse({ error: 'Không thấy ảnh.' }, 404);

  const type = obj.httpMetadata?.contentType || 'image/jpeg';
  const images = (env as unknown as { IMAGES?: any }).IMAGES;

  if (images && !/gif/i.test(type)) {
    try {
      const out = await images
        .input(obj.body)
        .transform({ width: 360, height: 360, fit: 'cover' })
        .output({ format: 'image/webp', quality: 72 });
      const res: Response = out.response();
      const headers = new Headers(res.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(res.body, { status: 200, headers });
    } catch {
      // Không thu nhỏ được thì trả ảnh gốc ở bên dưới.
    }
  }

  const fresh = await env.IMAGES_BUCKET.get(key);
  if (!fresh) return jsonResponse({ error: 'Không thấy ảnh.' }, 404);
  return new Response(fresh.body, {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};