import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { checkConnectorKey, jsonResponse } from '../../../lib/connector';

export const prerender = false;

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const POST: APIRoute = async ({ request }) => {
  if (!(await checkConnectorKey(request))) {
    return jsonResponse({ error: 'Sai khoá hoặc chưa có khoá.' }, 401);
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return jsonResponse({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }

  if (!file) return jsonResponse({ error: 'Chưa có file ảnh.' }, 400);
  const ext = TYPES[file.type];
  if (!ext) return jsonResponse({ error: 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.' }, 400);
  if (file.size > MAX_BYTES) return jsonResponse({ error: 'Ảnh quá nặng (tối đa 5MB).' }, 400);

  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);

  const key = `img/${hash}.${ext}`;
  const existing = await env.IMAGES_BUCKET.head(key);
  if (!existing) {
    await env.IMAGES_BUCKET.put(key, buffer, { httpMetadata: { contentType: file.type } });
  }

  const origin = new URL(request.url).origin;
  const url = `/media/?k=${key}`;
  return jsonResponse({ url, full_url: origin + url, key });
};