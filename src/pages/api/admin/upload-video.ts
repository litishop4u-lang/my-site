import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};
const MAX_SIZE = 50 * 1024 * 1024;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim();
  const ext = TYPES[type];
  if (!ext) {
    return json({ error: 'Chỉ nhận video MP4 hoặc WebM.' }, 400);
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (!length || length > MAX_SIZE) {
    return json({ error: 'Video quá lớn (tối đa 50 MB).' }, 400);
  }
  if (!request.body) {
    return json({ error: 'Không có dữ liệu video.' }, 400);
  }

  const key = `videos/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  await env.IMAGES_BUCKET.put(key, request.body, {
    httpMetadata: { contentType: type },
  });

  return json({ url: `/media/?k=${key}` });
};