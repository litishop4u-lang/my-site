import { IMAGE_RE, VIDEO_RE, parseBlocks } from './content';
import type { Block } from './content';

export const HTML_PREFIX = '<!--html-->';
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const SIZES = new Set(['s', 'm', 'l']);

const DROP_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select',
  'button', 'svg', 'math', 'link', 'meta', 'noscript', 'template', 'base', 'frame',
  'frameset', 'applet', 'title', 'head', 'audio', 'source', 'track', 'canvas', 'dialog',
]);

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'sub', 'sup', 'a', 'img', 'video',
  'figure',
]);

const STYLE_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'sub', 'sup', 'a',
]);

const COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/;
const SIZE_RE =
  /^(\d{1,3}(\.\d{1,2})?(px|pt|em|rem|%)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large)$/;
const FAMILY_RE = /^[A-Za-z0-9 ,"'\-]{1,120}$/;

function cleanStyle(style: string): string {
  const out: string[] = [];
  for (const part of style.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).trim();
    if (!value) continue;

    if (prop === 'color' || prop === 'background-color') {
      if (COLOR_RE.test(value)) out.push(`${prop}: ${value}`);
    } else if (prop === 'font-size') {
      if (SIZE_RE.test(value)) out.push(`font-size: ${value}`);
    } else if (prop === 'font-family') {
      if (FAMILY_RE.test(value)) out.push(`font-family: ${value}`);
    } else if (prop === 'font-weight') {
      if (/^(normal|bold|[1-9]00)$/.test(value)) out.push(`font-weight: ${value}`);
    } else if (prop === 'font-style') {
      if (/^(normal|italic)$/.test(value)) out.push(`font-style: ${value}`);
    } else if (prop === 'text-decoration' || prop === 'text-decoration-line') {
      if (/^(none|underline|line-through|underline line-through|line-through underline)$/.test(value)) {
        out.push(`text-decoration: ${value}`);
      }
    } else if (prop === 'text-align') {
      if (/^(left|right|center|justify)$/.test(value)) out.push(`text-align: ${value}`);
    }
  }
  return out.join('; ');
}

async function rewrite(html: string, rewriter: { transform(response: Response): Response }): Promise<string> {
  const response = rewriter.transform(
    new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
  );
  return await response.text();
}

export async function sanitizeHtml(html: string): Promise<string> {
  const rewriter = new HTMLRewriter()
    .onDocument({
      comments(comment: { remove(): void }) {
        comment.remove();
      },
    })
    .on('*', {
      element(el: any) {
        const tag = String(el.tagName).toLowerCase();

        if (DROP_TAGS.has(tag)) {
          el.remove();
          return;
        }
        if (!ALLOWED_TAGS.has(tag)) {
          el.removeAndKeepContent();
          return;
        }

        const attrs = Array.from(el.attributes) as [string, string][];
        const get = (name: string): string =>
          attrs.find(([key]) => key.toLowerCase() === name)?.[1] ?? '';
        for (const [name] of attrs) el.removeAttribute(name);

        if (STYLE_TAGS.has(tag)) {
          const style = cleanStyle(get('style'));
          if (style) el.setAttribute('style', style);
        }

        if (tag === 'a') {
          const href = get('href').trim();
          if (/^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(href)) {
            el.setAttribute('href', href);
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer nofollow');
          }
        } else if (tag === 'img') {
          const src = get('src');
          if (!IMAGE_RE.test(src)) {
            el.remove();
            return;
          }
          el.setAttribute('src', src);
          el.setAttribute('alt', get('alt').slice(0, 200));
          el.setAttribute('loading', 'lazy');
        } else if (tag === 'video') {
          const src = get('src');
          if (!VIDEO_RE.test(src)) {
            el.remove();
            return;
          }
          el.setAttribute('src', src);
          el.setAttribute('controls', '');
          el.setAttribute('preload', 'metadata');
          el.setAttribute('playsinline', '');
        } else if (tag === 'figure') {
          const size = get('data-size');
          if (SIZES.has(size)) el.setAttribute('data-size', size);
          const yt = get('data-yt');
          if (YT_ID_RE.test(yt)) el.setAttribute('data-yt', yt);
        }
      },
    });

  return await rewrite(html, rewriter);
}

export async function renderEmbeds(html: string, defaultAlt = ''): Promise<string> {
  const rewriter = new HTMLRewriter()
    .on('figure[data-yt]', {
      element(el: any) {
        const id = String(el.getAttribute('data-yt') ?? '');
        if (!YT_ID_RE.test(id)) {
          el.remove();
          return;
        }
        const rawSize = String(el.getAttribute('data-size') ?? 'l');
        const size = SIZES.has(rawSize) ? rawSize : 'l';
        el.replace(
          `<figure data-size="${size}"><div class="embed-wrap"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video YouTube" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div></figure>`,
          { html: true },
        );
      },
    })
    .on('img', {
      element(el: any) {
        if (defaultAlt && !el.getAttribute('alt')) el.setAttribute('alt', defaultAlt);
      },
    });

  return await rewrite(html, rewriter);
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `<h3>${esc(block.text)}</h3>`;
    case 'text':
      return block.text
        .split(/\n{2,}/)
        .map((para) => `<p>${esc(para.trim()).replace(/\n/g, '<br>')}</p>`)
        .join('');
    case 'image':
      return `<figure data-size="l"><img src="${block.url}" alt=""></figure>`;
    case 'video':
      return `<figure data-size="l"><video src="${block.url}" controls></video></figure>`;
    case 'youtube':
      return `<figure data-size="l" data-yt="${block.id}"></figure>`;
    default:
      return '';
  }
}

export function descriptionToHtml(raw?: string | null): string {
  const text = (raw ?? '').trim();
  if (!text) return '';
  if (text.startsWith(HTML_PREFIX)) return text.slice(HTML_PREFIX.length);
  if (text.startsWith('[')) return parseBlocks(text).map(blockToHtml).join('');
  if (text.startsWith('<')) return text;
  return parseBlocks(text).map(blockToHtml).join('');
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function cleanDescription(raw: string): Promise<string> {
  const text = raw.trim();
  if (!text) return '';
  const html = (await sanitizeHtml(text)).trim();
  const hasText = htmlToPlainText(html) !== '';
  const hasMedia = /<(img|video)\b|data-yt=/i.test(html);
  if (!hasText && !hasMedia) return '';
  return HTML_PREFIX + html;
}

export async function descriptionForEditor(raw?: string | null): Promise<string> {
  const html = descriptionToHtml(raw);
  if (!html) return '';
  return await sanitizeHtml(html);
}

export async function prepareDescription(raw?: string | null, alt = ''): Promise<string> {
  const html = descriptionToHtml(raw);
  if (!html) return '';
  return await renderEmbeds(await sanitizeHtml(html), alt);
}