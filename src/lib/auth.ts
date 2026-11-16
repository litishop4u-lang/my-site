import { env } from 'cloudflare:workers';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const MIN_PASSWORD = 8;

export type AdminRole = 'owner' | 'staff';

export type AdminUser = {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  salt: string;
  role: AdminRole;
  active: number;
};

const encoder = new TextEncoder();

function getSecrets() {
  const e = env as unknown as { ADMIN_PASSWORD?: string; SESSION_SECRET?: string };
  return { bootstrapPassword: e.ADMIN_PASSWORD ?? '', secret: e.SESSION_SECRET ?? '' };
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(size: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(size)));
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
  return toHex(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(saltHex), iterations: 100000 },
    keyMaterial,
    256,
  );
  return toHex(new Uint8Array(bits));
}

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,30}$/.test(username);
}

export async function findUserByUsername(username: string): Promise<AdminUser | null> {
  return await env.DB.prepare('SELECT * FROM admin_users WHERE username = ?')
    .bind(username)
    .first<AdminUser>();
}

export async function findUserById(id: number): Promise<AdminUser | null> {
  return await env.DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(id).first<AdminUser>();
}

export async function createUser(
  username: string,
  displayName: string,
  password: string,
  role: AdminRole,
): Promise<void> {
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  await env.DB.prepare(
    'INSERT INTO admin_users (username, display_name, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(username, displayName, hash, salt, role)
    .run();
}

export async function setPassword(id: number, password: string): Promise<void> {
  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  await env.DB.prepare('UPDATE admin_users SET password_hash = ?, salt = ? WHERE id = ?')
    .bind(hash, salt, id)
    .run();
}

export async function verifyPassword(user: AdminUser, password: string): Promise<boolean> {
  const hash = await hashPassword(password, user.salt);
  return safeEqual(hash, user.password_hash);
}

// Đăng nhập bằng tên đăng nhập + mật khẩu.
// Lần đầu tiên (bảng admin_users còn trống): ai nhập đúng mật khẩu cũ ADMIN_PASSWORD
// thì tên đăng nhập vừa gõ sẽ được tạo thành tài khoản chủ (owner).
export async function verifyLogin(usernameInput: string, password: string): Promise<AdminUser | null> {
  const username = normalizeUsername(usernameInput);
  if (!username || !password) return null;

  const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first<{ n: number }>();
  if (!countRow || countRow.n === 0) {
    const { bootstrapPassword, secret } = getSecrets();
    if (!isValidUsername(username) || !bootstrapPassword || !secret) return null;
    const [a, b] = await Promise.all([
      hmacHex(secret, 'pw:' + password),
      hmacHex(secret, 'pw:' + bootstrapPassword),
    ]);
    if (!safeEqual(a, b)) return null;
    await createUser(username, username, password, 'owner');
    return await findUserByUsername(username);
  }

  const user = await findUserByUsername(username);
  const hash = await hashPassword(password, user?.salt ?? '0'.repeat(32));
  if (!user || !user.active) return null;
  return safeEqual(hash, user.password_hash) ? user : null;
}

function sessionMessage(user: AdminUser, expires: number): string {
  return `session:${user.id}:${expires}:${user.password_hash.slice(0, 16)}`;
}

export async function createSession(user: AdminUser): Promise<string> {
  const { secret } = getSecrets();
  const expires = Date.now() + SESSION_SECONDS * 1000;
  const signature = await hmacHex(secret, sessionMessage(user, expires));
  return `${user.id}.${expires}.${signature}`;
}

export async function getSessionUser(token?: string): Promise<AdminUser | null> {
  const { secret } = getSecrets();
  if (!token || !secret) return null;
  const [idText, expiresText, signature] = token.split('.');
  const id = Number(idText);
  const expires = Number(expiresText);
  if (!signature || !Number.isInteger(id) || !Number.isFinite(expires) || expires < Date.now()) {
    return null;
  }
  const user = await findUserById(id);
  if (!user || !user.active) return null;
  const expected = await hmacHex(secret, sessionMessage(user, expires));
  return safeEqual(signature, expected) ? user : null;
}