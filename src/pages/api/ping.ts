import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async () => {
  const db = await env.DB.prepare('SELECT 1 AS ok').first();
  const list = await env.IMAGES_BUCKET.list({ limit: 1 });

  return new Response(
    JSON.stringify({ database: db, r2_ok: Array.isArray(list.objects) }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};