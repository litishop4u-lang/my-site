import { env } from 'cloudflare:workers';
import type { Product } from './db';

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

type Row = {
  name: string;
  sku: string | null;
  brand_name: string | null;
};

export async function searchProducts(query: string, limit = 8): Promise<Product[]> {
  const tokens = normalizeText(query)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 6);
  if (tokens.length === 0) return [];

  let rows: (Row & Record<string, unknown>)[] = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.name, p.slug, p.sku, p.price, p.old_price, p.image, p.images,
              p.category_id, p.brand_id, p.is_active, b.name AS brand_name
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.is_active = 1
       ORDER BY p.id DESC
       LIMIT 1000`,
    ).all<Row & Record<string, unknown>>();
    rows = results;
  } catch {
    return [];
  }

  const scored: { product: Product; score: number }[] = [];
  for (const row of rows) {
    const name = normalizeText(row.name);
    const haystack = `${name} ${normalizeText(row.sku ?? '')} ${normalizeText(row.brand_name ?? '')}`;
    if (!tokens.every((t) => haystack.includes(t))) continue;
    const pos = name.indexOf(tokens[0]);
    scored.push({
      product: row as unknown as Product,
      score: pos === -1 ? 1000 : pos,
    });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.product);
}