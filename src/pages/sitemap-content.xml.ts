import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

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
    // Chưa có bảng sản phẩm hoặc danh mục: bỏ qua.
  }

  try {
    const posts = await env.DB.prepare(
      'SELECT slug, updated_at FROM posts WHERE is_published = 1',
    ).all<{ slug: string; updated_at: string }>();
    for (const p of posts.results) {
      items.push({
        loc: `${origin}/blog/${p.slug}/`,
        lastmod: String(p.updated_at).slice(0, 10),
      });
    }
  } catch {
    // Chưa có bảng bài viết: bỏ qua.
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