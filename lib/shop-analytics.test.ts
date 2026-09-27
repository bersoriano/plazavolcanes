import { describe, expect, it } from "vitest";

import { summarizeShopAnalytics, type ProductStatsRow } from "@/lib/shop-analytics";

const row = (id: number, views: number, questions = 0, orders = 0, status = "published"): ProductStatsRow => ({
  product_id: id,
  name: `Producto ${id}`,
  slug: `producto-${id}`,
  status,
  views,
  questions,
  orders,
});

describe("summarizeShopAnalytics", () => {
  it("adds up the shop and works out questions per visit", () => {
    const summary = summarizeShopAnalytics([row(1, 40, 2, 1), row(2, 10, 1)]);

    expect(summary).toMatchObject({ views: 50, questions: 3, orders: 1, questionRate: 6 });
    expect(summary.top.map((item) => item.product_id)).toEqual([1, 2]);
  });

  it("flags published products people open but never ask about", () => {
    const summary = summarizeShopAnalytics([
      row(1, 30),
      row(2, 30, 1),
      row(3, 5),
      row(4, 50, 0, 0, "draft"),
      row(5, 12, 0, 1),
    ]);

    expect(summary.quiet.map((item) => item.product_id)).toEqual([1]);
  });

  it("has no rate before the first visit", () => {
    expect(summarizeShopAnalytics([row(1, 0)])).toMatchObject({ views: 0, questionRate: null, top: [] });
  });
});
