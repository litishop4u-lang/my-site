import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { slugify } from '../../../lib/slug';
import { uniqueTaxSlug } from '../../../lib/admin-taxonomy';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: { type?: string; name?: string } = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }

  const type = body.type === 'brand' ? 'brand' : body.type === 'category' ? 'category' : '';
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 100);
  if (!type) return json({ error: 'Loại không hợp lệ.' }, 400);
  if (!name) return json({ error: 'Vui lòng nhập tên.' }, 400);

  const table = type === 'brand' ? 'brands' : 'categories';

  const existing = await env.DB.prepare(`SELECT id, name FROM ${table} WHERE lower(name) = lower(?)`)
    .bind(name)
    .first<{ id: number; name: string }>();
  if (existing) {
    return json({ id: existing.id, name: existing.name, existed: true });
  }

  const slug = await uniqueTaxSlug(table, slugify(name));

  if (type === 'category') {
    const row = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM categories').first<{
      n: number;
    }>();
    await env.DB.prepare(
      'INSERT INTO categories (name, slug, sort_order, show_on_home) VALUES (?, ?, ?, 1)',
    )
      .bind(name, slug, (row?.n ?? 0) + 1)
      .run();
  } else {
    await env.DB.prepare('INSERT INTO brands (name, slug) VALUES (?, ?)').bind(name, slug).run();
  }

  const created = await env.DB.prepare(`SELECT id, name FROM ${table} WHERE slug = ?`)
    .bind(slug)
    .first<{ id: number; name: string }>();
  if (!created) return json({ error: 'Không thêm được.' }, 500);

  return json({ id: created.id, name: created.name, existed: false });
};