import type { APIRoute } from 'astro';
import { emptyPost, insertPost, uniquePostSlug } from '../../../lib/admin-posts';
import type { PostInput } from '../../../lib/admin-posts';
import { HTML_PREFIX } from '../../../lib/rich';
import { slugify } from '../../../lib/slug';
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

  const title = String(body.title ?? '').trim().slice(0, 200);
  if (!title) return jsonResponse({ error: 'Vui lòng nhập tiêu đề bài viết.' }, 400);

  const rawContent = typeof body.content === 'string' ? body.content.trim().slice(0, 300000) : '';
  if (!rawContent) return jsonResponse({ error: 'Bài viết chưa có nội dung.' }, 400);
  const content = rawContent.startsWith(HTML_PREFIX) ? rawContent : HTML_PREFIX + rawContent;

  const image = String(body.image ?? '').trim();
  const slug = await uniquePostSlug(slugify(title) || 'bai-viet');

  const post: PostInput = {
    ...emptyPost(),
    title,
    slug,
    description: String(body.description ?? '').trim().slice(0, 300),
    image: image.startsWith('/media/?k=img/') ? image : '',
    content,
    is_published: body.is_published === false || body.is_published === 0 ? 0 : 1,
  };

  try {
    await insertPost(post);
  } catch {
    return jsonResponse({ error: 'Không lưu được bài viết, hãy thử lại.' }, 500);
  }

  const origin = new URL(request.url).origin;
  return jsonResponse({ ok: true, slug, url: `/blog/${slug}/`, full_url: `${origin}/blog/${slug}/` });
};