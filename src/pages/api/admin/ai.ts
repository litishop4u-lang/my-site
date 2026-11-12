import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSettings } from '../../../lib/db';
import { sanitizeHtml } from '../../../lib/rich';

export const prerender = false;

const DEFAULT_MODEL = '@cf/aisingapore/gemma-sea-lion-v4-27b-it';
const FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const LENGTHS = {
  short: { words: '120 đến 180 từ', tokens: 800 },
  medium: { words: '250 đến 350 từ', tokens: 1400 },
  long: { words: '450 đến 600 từ', tokens: 2200 },
};

const TONES = {
  friendly: 'thân thiện, gần gũi, dễ hiểu',
  professional: 'chuyên nghiệp, đáng tin cậy',
  concise: 'ngắn gọn, đi thẳng vào lợi ích',
};

const HTML_RULES =
  'ĐỊNH DẠNG ĐẦU RA: chỉ trả về HTML sạch gồm các thẻ <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>. Không dùng Markdown, không dùng khối mã, không có lời dẫn hay lời giải thích nào ngoài nội dung bài.';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clip(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, max);
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractText(result: any): string {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (typeof result.response === 'string') return result.response;
  const choice = result.choices?.[0];
  if (choice?.message?.content) return String(choice.message.content);
  if (typeof choice?.text === 'string') return choice.text;
  if (typeof result.result?.response === 'string') return result.result.response;
  if (typeof result.output_text === 'string') return result.output_text;
  return '';
}

function toHtml(raw: string): string {
  let text = raw
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  const firstTag = text.search(/<(h2|h3|p|ul|ol)\b/i);
  if (firstTag > 0) text = text.slice(firstTag);
  if (/<(p|h2|h3|ul|ol|li)\b/i.test(text)) return text;

  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length > 0) {
      out.push('<ul>' + list.map((li) => `<li>${li}</li>`).join('') + '</ul>');
      list = [];
    }
  };

  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^#{1,2}\s+(.*)$/))) {
      flush();
      out.push(`<h2>${inline(m[1])}</h2>`);
    } else if ((m = l.match(/^#{3,6}\s+(.*)$/))) {
      flush();
      out.push(`<h3>${inline(m[1])}</h3>`);
    } else if ((m = l.match(/^[-*•]\s+(.*)$/))) {
      list.push(inline(m[1]));
    } else {
      flush();
      out.push(`<p>${inline(l)}</p>`);
    }
  }
  flush();
  return out.join('');
}

export const POST: APIRoute = async ({ request }) => {
  const ai = (env as unknown as {
    AI?: { run(model: string, input: unknown): Promise<unknown> };
  }).AI;
  if (!ai) {
    return json(
      { error: 'Chưa bật Workers AI. Hãy thêm cấu hình "ai" vào wrangler.jsonc rồi đưa lên mạng.' },
      500,
    );
  }

  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }

  const mode = String(body.mode ?? '');
  const ctx = (body.context ?? {}) as Record<string, any>;
  const instruction = clip(body.instruction, 1500);
  const selected = clip(body.selected, 4000);
  const len = LENGTHS[body.length as keyof typeof LENGTHS] ?? LENGTHS.medium;
  const tone = TONES[body.tone as keyof typeof TONES] ?? TONES.friendly;

  const settings = await getSettings();
  const siteName = settings.site_name || 'cửa hàng';
  const notes = clip(settings.ai_notes, 1500);
  const primary = (settings.ai_model || '').trim() || DEFAULT_MODEL;

  const base = [
    `Bạn là biên tập viên nội dung cho cửa hàng xe đạp điện "${siteName}" tại Việt Nam. Viết bằng tiếng Việt tự nhiên, rõ ràng, đúng chính tả.`,
    'QUY TẮC BẮT BUỘC:',
    '- Chỉ dùng thông tin được cung cấp. Tuyệt đối không bịa thông số kỹ thuật, giá, thời gian bảo hành, quà tặng, khuyến mãi, chứng nhận, số liệu hay so sánh với đối thủ.',
    '- Nếu thiếu thông tin thì bỏ qua ý đó, không đoán.',
    '- Không dùng từ cường điệu tuyệt đối như "số 1", "tốt nhất", "rẻ nhất", "100%" trừ khi được cung cấp.',
    '- Không chèn số điện thoại hoặc đường dẫn.',
  ].join('\n');

  let system = base;
  let user = '';
  let maxTokens = len.tokens;
  let kind: 'html' | 'meta' | 'titles' = 'html';

  if (mode === 'product_description') {
    const name = clip(ctx.name, 200);
    if (!name) return json({ error: 'Hãy nhập tên sản phẩm trước khi nhờ AI viết.' }, 400);
    const specs = Array.isArray(ctx.specs)
      ? ctx.specs
          .slice(0, 30)
          .map((s: any) => `- ${clip(s?.label, 80)}: ${clip(s?.value, 160)}`)
          .join('\n')
      : '';
    const data = [
      `Tên sản phẩm: ${name}`,
      ctx.brand ? `Thương hiệu: ${clip(ctx.brand, 100)}` : '',
      ctx.category ? `Danh mục: ${clip(ctx.category, 100)}` : '',
      specs ? `Thông số kỹ thuật:\n${specs}` : '',
      notes ? `Thông tin cửa hàng (đáng tin cậy):\n${notes}` : '',
      instruction ? `Yêu cầu thêm từ người viết: ${instruction}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    system = `${base}\n\n${HTML_RULES}`;
    user = `Hãy viết phần mô tả cho sản phẩm dưới đây để đăng trên website bán hàng.
Độ dài khoảng ${len.words}. Giọng văn: ${tone}.
Cấu trúc gợi ý: một đoạn mở đầu hấp dẫn; mục <h2>Điểm nổi bật</h2> dạng danh sách; mục <h2>Phù hợp với ai</h2>; mục <h2>Thông số nổi bật</h2> chỉ liệt kê đúng các thông số được cung cấp (bỏ mục này nếu không có thông số); đoạn kết mời khách liên hệ để được tư vấn (không ghi số điện thoại).
Không ghi giá bán trong bài.

DỮ LIỆU:
${data}`;
  } else if (mode === 'article') {
    const title = clip(ctx.title, 200);
    if (!title && !instruction) {
      return json({ error: 'Hãy ghi tiêu đề hoặc chủ đề và ý chính vào ô ghi chú để AI viết.' }, 400);
    }
    const what = ctx.kind === 'about' ? 'giới thiệu về cửa hàng' : 'tin tức hoặc chia sẻ kiến thức';
    const data = [
      title ? `Tiêu đề bài: ${title}` : '',
      instruction ? `Chủ đề và ý chính người viết cung cấp: ${instruction}` : '',
      notes ? `Thông tin cửa hàng (đáng tin cậy):\n${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    system = `${base}\n\n${HTML_RULES}`;
    user = `Hãy viết một bài ${what} để đăng trên website.
Độ dài khoảng ${len.words}. Giọng văn: ${tone}.
Cấu trúc: một đoạn mở đầu; từ 3 đến 5 mục, mỗi mục có <h2> và đoạn văn (có thể có danh sách); một đoạn kết.

DỮ LIỆU:
${data}`;
  } else if (mode === 'rewrite') {
    if (!selected) {
      return json({ error: 'Hãy bôi đen đoạn văn cần viết lại trong trình soạn trước.' }, 400);
    }
    system = `${base}\n\n${HTML_RULES}`;
    user = `Hãy viết lại đoạn văn sau theo yêu cầu. Giữ nguyên ý chính và thông tin, không thêm dữ kiện mới.
Yêu cầu: ${instruction || 'viết mượt hơn, rõ ràng hơn'}. Giọng văn: ${tone}.

ĐOẠN GỐC:
${selected}`;
    maxTokens = Math.min(len.tokens, 1800);
  } else if (mode === 'meta') {
    kind = 'meta';
    const title = clip(ctx.title, 200);
    const text = clip(ctx.text, 3000);
    if (!title && !text) return json({ error: 'Chưa có tiêu đề hoặc nội dung để tóm tắt.' }, 400);
    system = `${base}\n\nĐỊNH DẠNG ĐẦU RA: chỉ trả về một đoạn văn bản thuần (không HTML, không Markdown, không dấu ngoặc kép).`;
    user = `Hãy viết một đoạn mô tả ngắn cho Google (từ 120 đến 155 ký tự, một đến hai câu, có từ khóa chính tự nhiên, hấp dẫn người đọc bấm vào) cho bài viết sau.
Tiêu đề: ${title}
Nội dung: ${text}`;
    maxTokens = 300;
  } else if (mode === 'titles') {
    kind = 'titles';
    const text = clip(ctx.text, 3000);
    const title = clip(ctx.title, 200);
    if (!title && !text && !instruction) {
      return json({ error: 'Hãy nhập tiêu đề tạm hoặc nội dung bài trước.' }, 400);
    }
    system = `${base}\n\nĐỊNH DẠNG ĐẦU RA: chỉ trả về đúng 5 dòng, mỗi dòng một tiêu đề, không đánh số, không dấu ngoặc kép, không lời dẫn.`;
    user = `Hãy gợi ý 5 tiêu đề hấp dẫn, tối đa 70 ký tự mỗi tiêu đề, cho bài viết sau. Mỗi tiêu đề một cách tiếp cận khác nhau.
Tiêu đề tạm: ${title}
Nội dung: ${text}
${instruction ? `Gợi ý thêm: ${instruction}` : ''}`;
    maxTokens = 400;
  } else {
    return json({ error: 'Chế độ không hợp lệ.' }, 400);
  }

  const models = [primary];
  if (primary !== FALLBACK_MODEL) models.push(FALLBACK_MODEL);

  let text = '';
  let usedModel = '';
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const result = await ai.run(model, {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.6,
      });
      const out = extractText(result).trim();
      if (out) {
        text = out;
        usedModel = model;
        break;
      }
      lastError = new Error('Mô hình không trả về nội dung.');
    } catch (err) {
      lastError = err;
    }
  }

  if (!text) {
    const message = String((lastError as Error)?.message ?? lastError ?? '');
    const quota = /neuron|daily|free allocation|quota|rate limit|4006/i.test(message);
    return json(
      {
        error: quota
          ? 'Đã hết hạn mức AI miễn phí hôm nay (làm mới lúc 7 giờ sáng giờ Việt Nam). Hãy thử lại sau.'
          : 'AI chưa phản hồi được. Hãy thử lại sau ít phút hoặc đổi mô hình trong Cài đặt.',
        detail: message.slice(0, 300),
      },
      502,
    );
  }

  if (kind === 'meta') {
    const clean = text
      .replace(/\s+/g, ' ')
      .replace(/^["“'‘]+|["”'’]+$/g, '')
      .trim()
      .slice(0, 160);
    return json({ text: clean, model: usedModel });
  }

  if (kind === 'titles') {
    const titles = text
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["“'‘]+|["”'’]+$/g, '').trim())
      .filter((l) => l.length >= 8 && l.length <= 120)
      .slice(0, 5);
    if (titles.length === 0) return json({ error: 'AI chưa gợi ý được tiêu đề, hãy thử lại.' }, 502);
    return json({ titles, model: usedModel });
  }

  const html = (await sanitizeHtml(toHtml(text))).trim();
  if (!html) return json({ error: 'AI chưa viết được nội dung, hãy thử lại.' }, 502);
  return json({ html, model: usedModel });
};