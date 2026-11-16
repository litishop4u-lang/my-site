import { env } from 'cloudflare:workers';

export type Review = {
  id: number;
  name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type ReviewData = {
  count: number;
  avg: number;
  items: Review[];
};

export async function getReviewData(productId: number): Promise<ReviewData> {
  try {
    const stats = await env.DB.prepare(
      "SELECT COUNT(*) AS n, AVG(rating) AS a FROM product_reviews WHERE product_id = ? AND status = 'approved'",
    )
      .bind(productId)
      .first<{ n: number; a: number | null }>();
    const count = stats?.n ?? 0;
    if (count === 0) return { count: 0, avg: 0, items: [] };

    const { results } = await env.DB.prepare(
      "SELECT id, name, rating, comment, created_at FROM product_reviews WHERE product_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 50",
    )
      .bind(productId)
      .all<Review>();

    return { count, avg: stats?.a ?? 0, items: results };
  } catch {
    return { count: 0, avg: 0, items: [] };
  }
}

function clean(text: string): string {
  return text.replace(/[<>]/g, '');
}

// Thêm aggregateRating + review vào dữ liệu có cấu trúc (chỉ khi có đánh giá thật đã duyệt).
export function applyReviewSchema(schema: Record<string, unknown> | undefined, data: ReviewData): void {
  if (!schema || data.count === 0) return;
  schema.aggregateRating = {
    '@type': 'AggregateRating',
    ratingValue: Number(data.avg.toFixed(1)),
    reviewCount: data.count,
    bestRating: 5,
    worstRating: 1,
  };
  schema.review = data.items.slice(0, 10).map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: clean(r.name) },
    datePublished: r.created_at.slice(0, 10),
    reviewBody: clean(r.comment),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: r.rating,
      bestRating: 5,
      worstRating: 1,
    },
  }));
}