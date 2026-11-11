import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const key = url.searchParams.get('k') ?? '';

  if (!/^[a-z0-9\-/]+\.(jpg|png|webp|gif|mp4|webm)$/.test(key) || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  const wantsRange = request.headers.has('range');
  const object = await env.IMAGES_BUCKET.get(key, wantsRange ? { range: request.headers } : undefined);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');

  let status = 200;
  const range = object.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (wantsRange && range) {
    const size = object.size;
    let start = 0;
    let end = size - 1;
    if (range.suffix !== undefined) {
      start = Math.max(0, size - range.suffix);
    } else {
      start = range.offset ?? 0;
      end = range.length !== undefined ? start + range.length - 1 : size - 1;
    }
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    status = 206;
  }

  return new Response(object.body, { status, headers });
};