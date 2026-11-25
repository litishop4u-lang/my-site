import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getPostById, updatePost } from '../../../lib/admin-posts';
import type { PostInput } from '../../../lib/admin-posts';
import { HTML_PREFIX } from '../../../lib/rich';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

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

  const slug = String(body.slug ?? '').trim();
  if (!slug) return jsonResponse({ error: 'Thiếu đường dẫn bài viết.' }, 400);

  const row = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?').bind(slug).first<{ id: number }>();
  if (!row) return jsonResponse({ error: 'Không tìm thấy bài viết trên website.' }, 404);

  const existing = await getPostById(row.id);
  if (!existing) return jsonResponse({ error: 'Không đọc được bài viết.' }, 404);

  const title = body.title !== undefined ? String(body.title).trim().slice(0, 200) : existing.title;
  if (!title) return jsonResponse({ error: 'Vui lòng nhập tiêu đề bài viết.' }, 400);

  let content = existing.content;
  if (typeof body.content === 'string') {
    const c = body.content.trim().slice(0, 300000);
    if (!c) return jsonResponse({ error: 'Bài viết chưa có nội dung.' }, 400);
    content = c.startsWith(HTML_PREFIX) ? c : HTML_PREFIX + c;
  }

  let image = existing.image;
  if (body.image !== undefined) {
    const im = String(body.image ?? '').trim();
    image = im.startsWith('/media/?k=img/') ? im : '';
  }

  const updated: PostInput = {
    ...existing,
    title,
    slug: existing.slug,
    description: body.description !== undefined ? String(body.description).trim().slice(0, 300) : existing.description,
    image,
    content,
    is_published: 'is_published' in body ? (body.is_published ? 1 : 0) : existing.is_published,
  };

  try {
    await updatePost(row.id, updated);
  } catch {
    return jsonResponse({ error: 'Không lưu được thay đổi, hãy thử lại.' }, 500);
  }

  const origin = new URL(request.url).origin;
  return jsonResponse({ ok: true, slug: existing.slug, url: `/blog/${existing.slug}/`, full_url: `${origin}/blog/${existing.slug}/` });
};