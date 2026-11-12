import { env } from 'cloudflare:workers';
import { slugify } from './slug';
import { IMAGE_RE } from './content';
import { cleanDescription } from './rich';

export type PostInput = {
  title: string;
  slug: string;
  description: string;
  image: string;
  pub_date: string;
  is_published: number;
  content: string;
};

export type PostRow = {
  id: number;
  title: string;
  slug: string;
  image: string | null;
  is_published: number;
  pub_date: string;
  updated_at: string;
};

function todayVN(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function emptyPost(): PostInput {
  return {
    title: '',
    slug: '',
    description: '',
    image: '',
    pub_date: todayVN(),
    is_published: 1,
    content: '',
  };
}

export function parsePostForm(form: FormData): PostInput {
  const title = String(form.get('title') ?? '').trim().slice(0, 200);
  const image = String(form.get('image') ?? '').trim();
  const dateRaw = String(form.get('pub_date') ?? '').trim();

  return {
    title,
    slug: slugify(String(form.get('slug') ?? '').trim() || title),
    description: String(form.get('description') ?? '').trim().slice(0, 300),
    image: IMAGE_RE.test(image) ? image : '',
    pub_date: /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : todayVN(),
    is_published: form.get('is_published') ? 1 : 0,
    content: String(form.get('content') ?? '').slice(0, 300000),
  };
}

export async function uniquePostSlug(base: string, excludeId = 0): Promise<string> {
  const root = base || 'bai-viet';
  let slug = root;
  let n = 2;
  while (true) {
    const row = await env.DB.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?')
      .bind(slug, excludeId)
      .first();
    if (!row) return slug;
    slug = `${root}-${n}`;
    n++;
  }
}

export async function insertPost(p: PostInput): Promise<void> {
  const content = await cleanDescription(p.content);
  await env.DB.prepare(
    `INSERT INTO posts (title, slug, description, content, image, is_published, pub_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      p.title,
      p.slug,
      p.description || null,
      content || null,
      p.image || null,
      p.is_published,
      `${p.pub_date} 00:00:00`,
    )
    .run();
}

export async function updatePost(id: number, p: PostInput): Promise<void> {
  const content = await cleanDescription(p.content);
  await env.DB.prepare(
    `UPDATE posts SET
       title = ?, slug = ?, description = ?, content = ?, image = ?, is_published = ?,
       pub_date = ?, updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      p.title,
      p.slug,
      p.description || null,
      content || null,
      p.image || null,
      p.is_published,
      `${p.pub_date} 00:00:00`,
      id,
    )
    .run();
}

export async function deletePost(id: number): Promise<void> {
  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
}

export async function getPostById(id: number): Promise<(PostInput & { id: number }) | null> {
  const row = await env.DB.prepare('SELECT * FROM posts WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>();
  if (!row) return null;

  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    slug: String(row.slug ?? ''),
    description: String(row.description ?? ''),
    image: String(row.image ?? ''),
    pub_date: String(row.pub_date ?? '').slice(0, 10) || todayVN(),
    is_published: Number(row.is_published ?? 1),
    content: String(row.content ?? ''),
  };
}

export async function listAdminPosts(): Promise<PostRow[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, title, slug, image, is_published, pub_date, updated_at
       FROM posts
       ORDER BY pub_date DESC, id DESC
       LIMIT 300`,
    ).all<PostRow>();
    return results;
  } catch {
    return [];
  }
}