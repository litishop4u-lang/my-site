import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!(await checkConnectorKey(request))) {
    return jsonResponse({ error: 'Sai khoá hoặc chưa có khoá.' }, 401);
  }

  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }

  const slugs: string[] = Array.isArray(body.slugs)
    ? body.slugs
        .map((x: unknown) => String(x ?? '').trim())
        .filter((x: string) => x.length > 0 && x.length <= 200)
        .slice(0, 90)
    : [];

  if (slugs.length === 0) return jsonResponse({ items: {} });

  const marks = slugs.map(() => '?').join(',');
  const rs = await env.DB.prepare(`SELECT slug, is_published FROM posts WHERE slug IN (${marks})`)
    .bind(...slugs)
    .all<{ slug: string; is_published: number }>();

  const items: Record<string, number> = {};
  for (const row of rs.results ?? []) {
    items[row.slug] = row.is_published ? 1 : 0;
  }
  return jsonResponse({ items });
};