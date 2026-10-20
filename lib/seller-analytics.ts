import { z } from "zod";

const count = z.number().int().nonnegative();
export const analyticsMetricsSchema = z.object({
  views: count, tracked_views: count, interests: count,
  question_clicks: count, purchase_clicks: count, share_clicks: count,
  questions: count, orders: count,
}).refine((metrics) => metrics.interests <= metrics.tracked_views);

export const sellerAnalyticsSchema = z.object({
  shops: z.array(z.object({ id: count, name: z.string() })),
  current: analyticsMetricsSchema,
  previous: analyticsMetricsSchema,
  daily: z.array(analyticsMetricsSchema.and(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))),
  products: z.array(z.object({
    id: count, shop_id: count, shop_name: z.string(), name: z.string(), slug: z.string().nullable(), status: z.string(),
    current: analyticsMetricsSchema, previous: analyticsMetricsSchema,
  })),
  tracking_started_at: z.string(), start_day: z.string(), end_day: z.string(),
});
export type AnalyticsMetrics = z.infer<typeof analyticsMetricsSchema>;
export type SellerAnalytics = z.infer<typeof sellerAnalyticsSchema>;
export type AnalyticsFilters = { days: 7 | 30 | 90; shopId: number | null; invalidShop: boolean };

export function parseAnalyticsFilters(params: Record<string, string | string[] | undefined>): AnalyticsFilters {
  const days = params.dias === "7" ? 7 : params.dias === "90" ? 90 : 30;
  const shop = params.tienda;
  if (shop === undefined || shop === "" || shop === "todas") return { days, shopId: null, invalidShop: false };
  const shopId = typeof shop === "string" && /^[1-9]\d*$/.test(shop) ? Number(shop) : NaN;
  return { days, shopId: Number.isSafeInteger(shopId) ? shopId : null, invalidShop: !Number.isSafeInteger(shopId) };
}

export function interestRate(metrics: Pick<AnalyticsMetrics, "tracked_views" | "interests">): number | null {
  return metrics.tracked_views ? Math.round(metrics.interests / metrics.tracked_views * 1000) / 10 : null;
}

export function metricChange(current: number, previous: number): string {
  if (current === previous) return "Sin cambios";
  if (previous === 0) return "Sin base anterior";
  const change = Math.round(Math.abs(current - previous) / previous * 1000) / 10;
  return `${current > previous ? "+" : "−"}${new Intl.NumberFormat("es-MX").format(change)}% vs. periodo anterior`;
}
