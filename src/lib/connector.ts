import { env } from 'cloudflare:workers';

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

// So sánh khoá an toàn: băm cả hai về cùng độ dài rồi so từng byte.
export async function checkConnectorKey(request: Request): Promise<boolean> {
  const expected = (env as unknown as { CONNECTOR_KEY?: string }).CONNECTOR_KEY ?? '';
  if (expected.length < 32) return false;

  const header = request.headers.get('Authorization') ?? '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const given = m[1].trim();

  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode('connector-compare'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const a = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(given)));
  const b = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(expected)));

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}