import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getProductById } from '../../../lib/admin-products';
import { descriptionForEditor } from '../../../lib/rich';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await checkConnectorKey(request))) {
    return jsonResponse({ error: 'Sai khoá hoặc chưa có khoá.' }, 401);
  }

  const slug = (url.searchParams.get('slug') ?? '').trim();
  if (!slug) return jsonResponse({ error: 'Thiếu đường dẫn sản phẩm.' }, 400);

  const row = await env.DB.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (!row) return jsonResponse({ error: 'Không tìm thấy sản phẩm này trên website (có thể đã bị xoá).' }, 404);

  const p = await getProductById(row.id);
  if (!p) return jsonResponse({ error: 'Không đọc được sản phẩm.' }, 404);

  const rawDesc = p.description || '';
  const locked = /<(figure|img|video|iframe)\b/i.test(rawDesc);
  const html = locked ? '' : await descriptionForEditor(rawDesc);

  return jsonResponse({
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    category_id: p.category_id,
    brand_id: p.brand_id,
    price: p.price,
    old_price: p.old_price,
    images: p.images,
    videos: [],
    specs: p.specs,
    description: html,
    description_locked: locked,
    is_active: p.is_active,
    has_variants: p.variants.length > 0,
  });
};