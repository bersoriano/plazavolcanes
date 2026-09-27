/** The window the shop analytics card reports on. */
export const ANALYTICS_DAYS = 30;

/** Visits a product needs before "nobody asks" means something. */
export const QUIET_MIN_VIEWS = 10;

export type ProductStatsRow = {
  product_id: number;
  name: string;
  slug: string;
  status: string;
  views: number;
  questions: number;
  orders: number;
};

export type ShopAnalytics = {
  views: number;
  questions: number;
  orders: number;
  /** Questions per visit, 0–100; null before the first visit. */
  questionRate: number | null;
  /** The most-visited products. */
  top: ProductStatsRow[];
  /** Published products people open but never ask about or order. */
  quiet: ProductStatsRow[];
};

export function summarizeShopAnalytics(rows: ProductStatsRow[]): ShopAnalytics {
  const numeric = rows.map((row) => ({
    ...row,
    views: Number(row.views) || 0,
    questions: Number(row.questions) || 0,
    orders: Number(row.orders) || 0,
  }));
  const views = numeric.reduce((sum, row) => sum + row.views, 0);
  const questions = numeric.reduce((sum, row) => sum + row.questions, 0);
  const orders = numeric.reduce((sum, row) => sum + row.orders, 0);
  const byViews = [...numeric].sort((a, b) => b.views - a.views);

  return {
    views,
    questions,
    orders,
    questionRate: views ? Math.round((questions / views) * 1000) / 10 : null,
    top: byViews.filter((row) => row.views > 0).slice(0, 5),
    quiet: byViews
      .filter(
        (row) => row.status === "published" && row.views >= QUIET_MIN_VIEWS && row.questions === 0 && row.orders === 0,
      )
      .slice(0, 5),
  };
}
