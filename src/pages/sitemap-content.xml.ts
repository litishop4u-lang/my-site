import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getCollection } from 'astro:content';

export const prerender = false;

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const GET: APIRoute = async ({ site, url }) => {
  const origin = (site ?? new URL(url.origin)).origin;
  const items: { loc: string; lastmod?: string }[] = [];

  try {
    const products = await env.DB.prepare(
      'SELECT slug, updated_at FROM products WHERE is_active = 1',
    ).all<{ slug: string; updated_at: string }>();
    for (const p of products.results) {
      items.push({
        loc: `${origin}/san-pham/${p.slug}/`,
        lastmod: String(p.updated_at).slice(0, 10),
      });
    }

    const categories = await env.DB.prepare('SELECT slug FROM categories').all<{ slug: string }>();
    for (const c of categories.results) {
      items.push({ loc: `${origin}/danh-muc/${c.slug}/` });
    }
  } catch {
    // Chưa có bảng dữ liệu: bỏ qua phần sản phẩm và danh mục.
  }

  const posts = await getCollection('blog');
  for (const post of posts) {
    items.push({
      loc: `${origin}/blog/${post.id}/`,
      lastmod: (post.data.updatedDate ?? post.data.pubDate).toISOString().slice(0, 10),
    });
  }

  const body = items
    .map(
      (i) =>
        `<url><loc>${esc(i.loc)}</loc>${i.lastmod ? `<lastmod>${i.lastmod}</lastmod>` : ''}</url>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};