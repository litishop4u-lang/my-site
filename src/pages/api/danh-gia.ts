import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const slug = String(form.get('slug') ?? '').trim();

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return redirect('/', 303);
  }

  const back = (flag: string) => redirect(`/san-pham/${slug}/?review=${flag}#danh-gia`, 303);

  if (String(form.get('website') ?? '')) {
    return back('sent');
  }

  const name = String(form.get('name') ?? '').replace(/[<>]/g, '').trim().slice(0, 60);
  const comment = String(form.get('comment') ?? '').replace(/[<>]/g, '').trim().slice(0, 1000);
  const rating = Number(form.get('rating'));
  const shownAt = Number(form.get('t') ?? 0);

  if (name.length < 2 || comment.length < 10 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return back('invalid');
  }
  if (shownAt && Date.now() - shownAt < 3000) {
    return back('fast');
  }

  const product = await env.DB.prepare('SELECT id FROM products WHERE slug = ?')
    .bind(slug)
    .first<{ id: number }>();
  if (!product) {
    return redirect('/', 303);
  }

  const secret = String((env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET ?? '');
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  const ipHash = ip ? await sha256(`${ip}:${secret}`) : '';

  if (ipHash) {
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM product_reviews WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')",
    )
      .bind(ipHash)
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= 3) {
      return back('many');
    }
  }

  await env.DB.prepare(
    "INSERT INTO product_reviews (product_id, name, rating, comment, status, ip_hash) VALUES (?, ?, ?, ?, 'pending', ?)",
  )
    .bind(product.id, name, rating, comment, ipHash || null)
    .run();

  return back('sent');
};