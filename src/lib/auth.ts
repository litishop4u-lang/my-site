import { env } from 'cloudflare:workers';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function getSecrets() {
  const e = env as unknown as { ADMIN_PASSWORD?: string; SESSION_SECRET?: string };
  return { password: e.ADMIN_PASSWORD ?? '', secret: e.SESSION_SECRET ?? '' };
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const { password, secret } = getSecrets();
  if (!password || !secret) return false;
  const [a, b] = await Promise.all([
    hmacHex(secret, 'pw:' + input),
    hmacHex(secret, 'pw:' + password),
  ]);
  return safeEqual(a, b);
}

export async function createSession(): Promise<string> {
  const { secret } = getSecrets();
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const signature = await hmacHex(secret, 'session:' + expires);
  return `${expires}.${signature}`;
}

export async function isValidSession(token?: string): Promise<boolean> {
  const { secret } = getSecrets();
  if (!token || !secret) return false;
  const [expiresText, signature] = token.split('.');
  const expires = Number(expiresText);
  if (!signature || !Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = await hmacHex(secret, 'session:' + expires);
  return safeEqual(signature, expected);
}