import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_SIZE = 8 * 1024 * 1024;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');

  if (!file || typeof file === 'string') {
    return json({ error: 'Không có file ảnh.' }, 400);
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return json({ error: 'Chỉ nhận ảnh JPG, PNG, WebP hoặc GIF.' }, 400);
  }
  if (file.size > MAX_SIZE) {
    return json({ error: 'Ảnh quá lớn (tối đa 8 MB).' }, 400);
  }

  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);

  const key = `img/${hash}.${ext}`;
  const existing = await env.IMAGES_BUCKET.head(key);
  if (!existing) {
    await env.IMAGES_BUCKET.put(key, buffer, {
      httpMetadata: { contentType: file.type },
    });
  }

  return json({ url: `/media/?k=${key}`, existed: !!existing });
};