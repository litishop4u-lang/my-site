export type Spec = { label: string; value: string };

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'video'; url: string }
  | { type: 'youtube'; id: string };

export const IMAGE_RE = /^\/media\/\?k=[a-z0-9\-/]+\.(jpg|png|webp|gif)$/;
export const VIDEO_RE = /^\/media\/\?k=[a-z0-9\-/]+\.(mp4|webm)$/;
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export const MAX_IMAGES = 20;
export const MAX_SPECS = 40;
export const MAX_BLOCKS = 100;

function safeJson(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function youtubeId(input: string): string | null {
  const value = input.trim();
  if (YT_ID_RE.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') {
      id = url.pathname.slice(1).split('/')[0];
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        id = url.searchParams.get('v');
      } else {
        const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
        if (m) id = m[2];
      }
    }
    return id && YT_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function parseImages(raw?: string | null, fallback?: string | null): string[] {
  const data = safeJson(raw);
  let list: string[] = [];
  if (Array.isArray(data)) {
    list = data
      .filter((u): u is string => typeof u === 'string' && IMAGE_RE.test(u))
      .slice(0, MAX_IMAGES);
  }
  if (list.length === 0 && fallback) list = [fallback];
  return list;
}

export function parseSpecs(raw?: string | null): Spec[] {
  const data = safeJson(raw);
  if (!Array.isArray(data)) return [];
  const out: Spec[] = [];
  for (const item of data.slice(0, MAX_SPECS)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const label = String(row.label ?? '').trim().slice(0, 100);
    const value = String(row.value ?? '').trim().slice(0, 300);
    if (label || value) out.push({ label, value });
  }
  return out;
}

export function sanitizeBlocks(data: unknown[]): Block[] {
  const out: Block[] = [];
  for (const item of data.slice(0, MAX_BLOCKS)) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Record<string, unknown>;
    const type = String(b.type ?? '');

    if (type === 'heading' || type === 'text') {
      const text = String(b.text ?? '').trim().slice(0, 20000);
      if (text) out.push({ type, text });
    } else if (type === 'image') {
      const url = String(b.url ?? '');
      if (IMAGE_RE.test(url)) out.push({ type: 'image', url });
    } else if (type === 'video') {
      const url = String(b.url ?? '');
      if (VIDEO_RE.test(url)) out.push({ type: 'video', url });
    } else if (type === 'youtube') {
      const id = String(b.id ?? '');
      const parsed = YT_ID_RE.test(id) ? id : youtubeId(String(b.url ?? id));
      if (parsed) out.push({ type: 'youtube', id: parsed });
    }
  }
  return out;
}

export function parseBlocks(raw?: string | null): Block[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    const data = safeJson(text);
    if (Array.isArray(data)) return sanitizeBlocks(data);
  }
  return [{ type: 'text', text }];
}

export function blocksToPlainText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === 'text' || b.type === 'heading' ? b.text : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}