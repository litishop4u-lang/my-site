import type { APIRoute } from 'astro';
import { searchProducts } from '../../lib/search';
import { parseImages } from '../../lib/content';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const products = q ? await searchProducts(q, 6) : [];

  const items = products.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    old_price: p.old_price,
    image: parseImages(p.images, p.image)[0] ?? '',
  }));

  return new Response(JSON.stringify({ items }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    },
  });
};