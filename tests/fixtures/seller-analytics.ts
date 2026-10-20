import type { AnalyticsMetrics, SellerAnalytics } from "@/lib/seller-analytics";

export const emptyMetrics: AnalyticsMetrics = { views:0,tracked_views:0,interests:0,question_clicks:0,purchase_clicks:0,share_clicks:0,questions:0,orders:0 };
export function sellerAnalyticsFixture(): SellerAnalytics {
  const current={...emptyMetrics,views:40,tracked_views:20,interests:5,question_clicks:3,purchase_clicks:4,share_clicks:2,questions:2,orders:1};
  return { shops:[{id:1,name:"Casa Niebla"}],current,previous:{...emptyMetrics,views:20},
    daily:[{day:"2026-10-20",...current}],
    products:[{id:11,shop_id:1,shop_name:"Casa Niebla",name:"Taza de barro",slug:"taza",status:"published",current,previous:{...emptyMetrics}}],
    tracking_started_at:"2026-10-20T12:00:00Z",start_day:"2026-09-21",end_day:"2026-10-20" };
}
