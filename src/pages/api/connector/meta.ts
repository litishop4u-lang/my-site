import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getBrands } from '../../../lib/admin-products';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!(await checkConnectorKey(request))) {
    return jsonResponse({ error: 'Sai khoá hoặc chưa có khoá.' }, 401);
  }

  const cats = await env.DB.prepare('SELECT * FROM categories ORDER BY sort_order, id').all<any>();
  const brands = await getBrands();

  return jsonResponse({
    categories: (cats.results ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      parent_id: c.parent_id ?? null,
    })),
    brands: brands.map((b) => ({ id: b.id, name: b.name })),
  });
};