import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { deleteProduct } from '../../../lib/admin-products';
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

  const slug = String(body.slug ?? '').trim();
  if (!slug) return jsonResponse({ error: 'Thiếu đường dẫn sản phẩm.' }, 400);

  const row = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (!row) return jsonResponse({ ok: true, already: true });

  try {
    await deleteProduct(row.id);
  } catch {
    return jsonResponse({ error: 'Không xoá được sản phẩm, hãy thử lại.' }, 500);
  }

  return jsonResponse({ ok: true });
};