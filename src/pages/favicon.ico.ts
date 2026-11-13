import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const MEDIA = /^\/media\/\?k=(img\/[a-z0-9\-/]+\.(png|webp|jpg|gif))$/;

export const GET: APIRoute = async ({ redirect }) => {
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'favicon'").first<{
      value: string;
    }>();
    const match = MEDIA.exec(row?.value ?? '');
    if (match && !match[1].includes('..')) {
      const object = await env.IMAGES_BUCKET.get(match[1]);
      if (object) {
        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType ?? 'image/png',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
  } catch {
    // dùng biểu tượng mặc định bên dưới
  }
  return redirect('/favicon.svg', 302);
};