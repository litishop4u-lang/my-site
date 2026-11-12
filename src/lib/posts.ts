import { env } from 'cloudflare:workers';

export type Post = {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  content: string | null;
  image: string | null;
  is_published: number;
  pub_date: string;
  updated_at: string;
};

export function parseDbDate(value: string): Date {
  return new Date(value.replace(' ', 'T') + 'Z');
}

export function formatDate(value: string): string {
  return parseDbDate(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export async function listPosts(limit = 100): Promise<Post[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, title, slug, description, image, is_published, pub_date, updated_at
       FROM posts
       WHERE is_published = 1
       ORDER BY pub_date DESC, id DESC
       LIMIT ?`,
    )
      .bind(limit)
      .all<Post>();
    return results;
  } catch {
    return [];
  }
}

export async function getRecentPosts(limit = 3): Promise<Post[]> {
  return listPosts(limit);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    return await env.DB.prepare('SELECT * FROM posts WHERE slug = ? AND is_published = 1')
      .bind(slug)
      .first<Post>();
  } catch {
    return null;
  }
}