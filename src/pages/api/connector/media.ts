import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

const IMG_RE = /\.(jpe?g|png|webp|gif)$/i;

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await checkConnectorKey(request))) {
    return jsonResponse({ error: 'Sai khoá hoặc chưa có khoá.' }, 401);
  }

  const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
  const limit = Math.min(60, Math.max(1, parseInt(url.searchParams.get('limit') ?? '18', 10) || 18));

  const all: { key: string; size: number; uploaded: number }[] = [];
  let cursor: string | undefined = undefined;
  for (let i = 0; i < 5; i++) {
    const page: any = await env.IMAGES_BUCKET.list({ prefix: 'img/', limit: 1000, cursor });
    for (const o of page.objects ?? []) {
      if (IMG_RE.test(o.key)) {
        all.push({ key: o.key, size: o.size, uploaded: new Date(o.uploaded).getTime() });
      }
    }
    if (!page.truncated) break;
    cursor = page.cursor;
  }

  all.sort((a, b) => b.uploaded - a.uploaded);
  const slice = all.slice(offset, offset + limit);
  const next = offset + limit < all.length ? offset + limit : null;

  return jsonResponse({
    items: slice.map((o) => ({
      url: `/media/?k=${o.key}`,
      key: o.key,
      size: o.size,
      uploaded: new Date(o.uploaded).toISOString(),
    })),
    total: all.length,
    next,
    origin: new URL(request.url).origin,
  });
};