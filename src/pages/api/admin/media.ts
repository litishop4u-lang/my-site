import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const IMAGE_EXT = /\.(jpg|png|webp|gif)$/;

export const GET: APIRoute = async () => {
  const items: { url: string; size: number; uploaded: number }[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 5; page++) {
    const list = await env.IMAGES_BUCKET.list({ limit: 1000, cursor });
    for (const obj of list.objects) {
      if (IMAGE_EXT.test(obj.key)) {
        items.push({
          url: `/media/?k=${obj.key}`,
          size: obj.size,
          uploaded: obj.uploaded.getTime(),
        });
      }
    }
    if (!list.truncated) break;
    cursor = list.cursor;
  }

  items.sort((a, b) => b.uploaded - a.uploaded);

  return new Response(JSON.stringify({ items: items.slice(0, 500) }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};