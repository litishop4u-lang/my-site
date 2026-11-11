import { env } from 'cloudflare:workers';

export type TaxonomyTable = 'categories' | 'brands';

export async function uniqueTaxSlug(
  table: TaxonomyTable,
  base: string,
  excludeId = 0,
): Promise<string> {
  const root = base || 'muc';
  let slug = root;
  let n = 2;
  while (true) {
    const row = await env.DB.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`)
      .bind(slug, excludeId)
      .first();
    if (!row) return slug;
    slug = `${root}-${n}`;
    n++;
  }
}