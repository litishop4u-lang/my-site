import { env } from 'cloudflare:workers';
import { slugify } from './slug';

export type Brand = {
  id: number;
  name: string;
  slug: string;
};

export type ProductInput = {
  name: string;
  slug: string;
  sku: string;
  category_id: number | null;
  brand_id: number | null;
  price: number;
  old_price: number;
  image: string;
  description: string;
  is_active: number;
};

export type ProductRow = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  old_price: number;
  image: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  category_name: string | null;
  brand_name: string | null;
};

export function emptyProduct(): ProductInput {
  return {
    name: '',
    slug: '',
    sku: '',
    category_id: null,
    brand_id: null,
    price: 0,
    old_price: 0,
    image: '',
    description: '',
    is_active: 1,
  };
}

function toMoney(value: FormDataEntryValue | null): number {
  const n = parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function toId(value: FormDataEntryValue | null): number | null {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseProductForm(form: FormData): ProductInput {
  const name = String(form.get('name') ?? '').trim();
  const rawImage = String(form.get('image') ?? '').trim();
  const image = rawImage.startsWith('/media/') || rawImage.startsWith('https://') ? rawImage : '';

  return {
    name,
    slug: slugify(String(form.get('slug') ?? '').trim() || name),
    sku: String(form.get('sku') ?? '').trim(),
    category_id: toId(form.get('category_id')),
    brand_id: toId(form.get('brand_id')),
    price: toMoney(form.get('price')),
    old_price: toMoney(form.get('old_price')),
    image,
    description: String(form.get('description') ?? '').trim(),
    is_active: form.get('is_active') ? 1 : 0,
  };
}

export async function uniqueSlug(base: string, excludeId = 0): Promise<string> {
  const root = base || 'san-pham';
  let slug = root;
  let n = 2;
  while (true) {
    const row = await env.DB.prepare('SELECT id FROM products WHERE slug = ? AND id != ?')
      .bind(slug, excludeId)
      .first();
    if (!row) return slug;
    slug = `${root}-${n}`;
    n++;
  }
}

export async function getBrands(): Promise<Brand[]> {
  try {
    const { results } = await env.DB.prepare('SELECT id, name, slug FROM brands ORDER BY name').all<Brand>();
    return results;
  } catch {
    return [];
  }
}

export async function listProducts(options: { q: string; page: number }) {
  const pageSize = 20;
  const like = `%${options.q}%`;
  const base = `FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN brands b ON b.id = p.brand_id
    WHERE (? = '' OR p.name LIKE ? OR p.sku LIKE ?)`;

  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS n ${base}`)
    .bind(options.q, like, like)
    .first<{ n: number }>();

  const { results } = await env.DB.prepare(
    `SELECT p.id, p.name, p.slug, p.sku, p.price, p.old_price, p.image, p.is_active,
            p.created_at, p.updated_at, c.name AS category_name, b.name AS brand_name
     ${base}
     ORDER BY p.id DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(options.q, like, like, pageSize, (options.page - 1) * pageSize)
    .all<ProductRow>();

  return { items: results, total: totalRow?.n ?? 0, pageSize };
}

export async function getProductById(id: number): Promise<(ProductInput & { id: number }) | null> {
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return null;

  return {
    id: Number(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    sku: String(row.sku ?? ''),
    category_id: row.category_id == null ? null : Number(row.category_id),
    brand_id: row.brand_id == null ? null : Number(row.brand_id),
    price: Number(row.price ?? 0),
    old_price: Number(row.old_price ?? 0),
    image: String(row.image ?? ''),
    description: String(row.description ?? ''),
    is_active: Number(row.is_active ?? 1),
  };
}

export async function insertProduct(p: ProductInput): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO products
      (name, slug, sku, category_id, brand_id, price, old_price, image, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      p.name,
      p.slug,
      p.sku || null,
      p.category_id,
      p.brand_id,
      p.price,
      p.old_price,
      p.image || null,
      p.description || null,
      p.is_active,
    )
    .run();
}

export async function updateProduct(id: number, p: ProductInput): Promise<void> {
  await env.DB.prepare(
    `UPDATE products SET
       name = ?, slug = ?, sku = ?, category_id = ?, brand_id = ?, price = ?, old_price = ?,
       image = ?, description = ?, is_active = ?, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      p.name,
      p.slug,
      p.sku || null,
      p.category_id,
      p.brand_id,
      p.price,
      p.old_price,
      p.image || null,
      p.description || null,
      p.is_active,
      id,
    )
    .run();
}

export async function deleteProduct(id: number): Promise<void> {
  await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
}