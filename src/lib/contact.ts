export function messengerLink(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (/^https:\/\//i.test(v)) return v;
  if (/^[A-Za-z0-9._-]{3,}$/.test(v)) return `https://m.me/${v}`;
  return '';
}

export function safeUrl(value: string): string {
  const v = value.trim();
  return /^https:\/\//i.test(v) ? v.slice(0, 500) : '';
}

export function mapEmbedSrc(raw: string | null | undefined, address: string): string {
  const text = (raw ?? '').trim();
  const fromTag = text.match(/src\s*=\s*["']([^"']+)["']/i);
  const candidate = (fromTag ? fromTag[1] : text).replace(/&amp;/g, '&');
  if (/^https:\/\/www\.google\.com\/maps\/embed\?/i.test(candidate)) return candidate;
  if (address) {
    return `https://www.google.com/maps?q=${encodeURIComponent(address)}&hl=vi&z=16&output=embed`;
  }
  return '';
}

export function directionsUrl(address: string): string {
  return address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
    : '';
}

export function splitList(value: string | null | undefined, max = 6): string[] {
  return (value ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function parseLines(
  value: string | null | undefined,
): { label: string; number: string }[] {
  const out: { label: string; number: string }[] = [];
  for (const raw of (value ?? '').split(/\r?\n/)) {
    const i = raw.indexOf('|');
    if (i < 0) continue;
    const label = raw.slice(0, i).trim();
    const number = raw.slice(i + 1).trim();
    if (label && number) out.push({ label, number });
  }
  return out.slice(0, 10);
}