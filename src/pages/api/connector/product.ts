import type { APIRoute } from 'astro';
import { insertProduct, uniqueSlug } from '../../../lib/admin-products';
import type { ProductInput } from '../../../lib/admin-products';
import { HTML_PREFIX } from '../../../lib/rich';
import { slugify } from '../../../lib/slug';
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

  const name = String(body.name ?? '').trim().slice(0, 200);
  if (!name) return jsonResponse({ error: 'Vui lòng nhập tên sản phẩm.' }, 400);

  const images: string[] = Array.isArray(body.images)
    ? body.images
        .map((x: unknown) => String(x ?? '').trim())
        .filter((x: string) => x.startsWith('/media/?k=img/'))
        .slice(0, 20)
    : [];
  if (images.length === 0) return jsonResponse({ error: 'Cần ít nhất một ảnh.' }, 400);

  const specs = Array.isArray(body.specs)
    ? body.specs
        .map((s: any) => ({
          label: String(s?.label ?? '').trim().slice(0, 80),
          value: String(s?.value ?? '').trim().slice(0, 200),
        }))
        .filter((s: { label: string; value: string }) => s.label && s.value)
        .slice(0, 30)
    : [];

  const rawDesc = typeof body.description === 'string' ? body.description.trim().slice(0, 300000) : '';
  const description = rawDesc ? (rawDesc.startsWith(HTML_PREFIX) ? rawDesc : HTML_PREFIX + rawDesc) : '';

  const slug = await uniqueSlug(slugify(name) || 'san-pham');

  const product: ProductInput = {
    name,
    slug,
    sku: String(body.sku ?? '').trim().slice(0, 60),
    category_id: toId(body.category_id),
    brand_id: toId(body.brand_id),
    price: toMoney(body.price),
    old_price: toMoney(body.old_price),
    image: images[0],
    images,
    specs,
    variants: [],
    description,
    is_active: body.is_active === false || body.is_active === 0 ? 0 : 1,
  };

  try {
    await insertProduct(product);
  } catch {
    return jsonResponse({ error: 'Không lưu được sản phẩm, hãy thử lại.' }, 500);
  }

  const origin = new URL(request.url).origin;
  return jsonResponse({ ok: true, slug, url: `/san-pham/${slug}/`, full_url: `${origin}/san-pham/${slug}/` });
};