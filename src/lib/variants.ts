export type VariantOption = { label: string; price: number };
export type VariantGroup = { name: string; options: VariantOption[] };

export const MAX_VARIANT_GROUPS = 5;
export const MAX_VARIANT_OPTIONS = 30;

export function parseVariants(raw?: string | null): VariantGroup[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: VariantGroup[] = [];
  for (const g of data.slice(0, MAX_VARIANT_GROUPS)) {
    if (!g || typeof g !== 'object') continue;
    const row = g as Record<string, unknown>;
    const name = String(row.name ?? '').trim().slice(0, 60);
    const options: VariantOption[] = [];
    if (Array.isArray(row.options)) {
      for (const o of row.options.slice(0, MAX_VARIANT_OPTIONS)) {
        if (!o || typeof o !== 'object') continue;
        const opt = o as Record<string, unknown>;
        const label = String(opt.label ?? '').trim().slice(0, 80);
        const price = Math.max(0, Math.floor(Number(opt.price) || 0));
        if (label) options.push({ label, price });
      }
    }
    if (name && options.length > 0) out.push({ name, options });
  }
  return out;
}