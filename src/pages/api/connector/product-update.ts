import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getProductById, updateProduct } from '../../../lib/admin-products';
import type { ProductInput } from '../../../lib/admin-products';
import { HTML_PREFIX } from '../../../lib/rich';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

function toId(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toMoney(v: unknown): number {
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

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
  if (!row) return jsonResponse({ error: 'Không tìm thấy sản phẩm trên website.' }, 404);

  const existing = await getProductById(row.id);
  if (!existing) return jsonResponse({ error: 'Không đọc được sản phẩm.' }, 404);

  const name = body.name !== undefined ? String(body.name).trim().slice(0, 200) : existing.name;
  if (!name) return jsonResponse({ error: 'Vui lòng nhập tên sản phẩm.' }, 400);

  let images = existing.images;
  if (Array.isArray(body.images)) {
    images = body.images
      .map((x: unknown) => String(x ?? '').trim())
      .filter((x: string) => x.startsWith('/media/?k=img/'))
      .slice(0, 20);
    if (images.length === 0) return jsonResponse({ error: 'Cần ít nhất một ảnh.' }, 400);
  }

  let specs = existing.specs;
  if (Array.isArray(body.specs)) {
    specs = body.specs
      .map((s: any) => ({
        label: String(s?.label ?? '').trim().slice(0, 80),
        value: String(s?.value ?? '').trim().slice(0, 200),
      }))
      .filter((s: { label: string; value: string }) => s.label && s.value)
      .slice(0, 30);
  }

  let description = existing.description;
  const locked = false;
  if (typeof body.description === 'string' && !locked) {
    const d = body.description.trim().slice(0, 300000);
    description = d ? (d.startsWith(HTML_PREFIX) ? d : HTML_PREFIX + d) : '';
  }

  const updated: ProductInput = {
    name,
    slug: existing.slug,
    sku: body.sku !== undefined ? String(body.sku).trim().slice(0, 60) : existing.sku,
    category_id: 'category_id' in body ? toId(body.category_id) : existing.category_id,
    brand_id: 'brand_id' in body ? toId(body.brand_id) : existing.brand_id,
    price: 'price' in body ? toMoney(body.price) : existing.price,
    old_price: 'old_price' in body ? toMoney(body.old_price) : existing.old_price,
    image: images[0] ?? '',
    images,
    specs,
    variants: existing.variants,
    description,
    is_active: 'is_active' in body ? (body.is_active ? 1 : 0) : existing.is_active,
  };

  try {
    await updateProduct(row.id, updated);
  } catch {
    return jsonResponse({ error: 'Không lưu được thay đổi, hãy thử lại.' }, 500);
  }

  const origin = new URL(request.url).origin;
  return jsonResponse({ ok: true, slug: existing.slug, url: `/san-pham/${existing.slug}/`, full_url: `${origin}/san-pham/${existing.slug}/` });
};