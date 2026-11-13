import { env } from 'cloudflare:workers';
import type { Product } from './db';

export type CatalogProduct = Product & {
  brand_name: string | null;
  brand_slug: string | null;
};

export function orderCategories<T extends { id: number; parent_id?: number | null }>(list: T[]): T[] {
  const out: T[] = [];
  for (const top of list.filter((c) => !c.parent_id)) {
    out.push(top);
    for (const child of list) {
      if (child.parent_id === top.id) out.push(child);
    }
  }
  for (const c of list) {
    if (c.parent_id && !out.includes(c)) out.push(c);
  }
  return out;
}

export async function getProductsForCategories(ids: number[]): Promise<CatalogProduct[]> {
  if (ids.length === 0) return [];
  const marks = ids.map(() => '?').join(',');
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.name, p.slug, p.sku, p.price, p.old_price, p.image, p.images,
              p.category_id, p.brand_id, p.is_active,
              b.name AS brand_name, b.slug AS brand_slug
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.is_active = 1 AND p.category_id IN (${marks})
      ORDER BY (CASE WHEN p.sort_order > 0 THEN 0 ELSE 1 END), p.sort_order, p.id DESC
       LIMIT 1000`,
    )
      .bind(...ids)
      .all<CatalogProduct>();
    return results;
  } catch {
    return [];
  }
}