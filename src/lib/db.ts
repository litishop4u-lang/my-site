import { env } from 'cloudflare:workers';

export type Settings = Record<string, string>;

export type Category = {
  parent_id?: number | null;
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  show_on_home: number;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  category_id: number | null;
  brand_id: number | null;
  price: number;
  old_price: number;
  image: string | null;
  images?: string | null;
  specs?: string | null;
  description: string | null;
  is_active: number;
  category_name?: string | null;
  category_slug?: string | null;
  brand_name?: string | null;
};

export function formatPrice(value: number): string {
  return value.toLocaleString('vi-VN') + ' đ';
}

export async function getSettings(): Promise<Settings> {
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{
      key: string;
      value: string;
    }>();
    return Object.fromEntries(results.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM categories ORDER BY sort_order, id',
    ).all<Category>();
    return results;
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return await env.DB.prepare('SELECT * FROM categories WHERE slug = ?').bind(slug).first<Category>();
}

export async function getProducts(
  options: { categoryId?: number; limit?: number } = {},
): Promise<Product[]> {
  const limit = options.limit ?? 200;
  const statement = options.categoryId
    ? env.DB.prepare(
      'SELECT * FROM products WHERE is_active = 1 AND category_id = ? ORDER BY (CASE WHEN sort_order > 0 THEN 0 ELSE 1 END), sort_order, id DESC LIMIT ?',
      ).bind(options.categoryId, limit)
    : env.DB.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY (CASE WHEN sort_order > 0 THEN 0 ELSE 1 END), sort_order, id DESC LIMIT ?').bind(
        limit,
      );
  const { results } = await statement.all<Product>();
  return results;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  return await env.DB.prepare(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug, b.name AS brand_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN brands b ON b.id = p.brand_id
     WHERE p.slug = ? AND p.is_active = 1`,
  )
    .bind(slug)
    .first<Product>();
}

export async function getRelatedProducts(
  productId: number,
  categoryId: number | null,
  limit = 3,
): Promise<Product[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM products
       WHERE is_active = 1 AND id != ?
       ORDER BY (CASE WHEN category_id IS ? THEN 0 ELSE 1 END), id DESC
       LIMIT ?`,
    )
      .bind(productId, categoryId, limit)
      .all<Product>();
    return results;
  } catch {
    return [];
  }
}

export type Banner = {
  id: number;
  image: string;
  alt: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: number;
};

export async function getBanners(): Promise<Banner[]> {
  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order, id',
    ).all<Banner>();
    return results;
  } catch {
    return [];
  }
}