import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getPostById } from '../../../lib/admin-posts';
import { descriptionForEditor } from '../../../lib/rich';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  if (!(await checkConnectorKey(request))) {
    return jsonResponse({ error: 'Sai khoá hoặc chưa có khoá.' }, 401);
  }

  const slug = (url.searchParams.get('slug') ?? '').trim();
  if (!slug) return jsonResponse({ error: 'Thiếu đường dẫn bài viết.' }, 400);

  const row = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (!row) return jsonResponse({ error: 'Không tìm thấy bài viết này trên website (có thể đã bị xoá).' }, 404);

  const p = await getPostById(row.id);
  if (!p) return jsonResponse({ error: 'Không đọc được bài viết.' }, 404);

  return jsonResponse({
    slug: p.slug,
    title: p.title,
    description: p.description,
    image: p.image,
    content: await descriptionForEditor(p.content || ''),
    is_published: p.is_published,
  });
};