import { describe, expect, it } from "vitest";

import {
  buildSellerDashboard,
  buyerIsWaiting,
  describeGaps,
  formatWaiting,
  listingGaps,
  type DashboardConversation,
  type DashboardOrder,
  type DashboardProduct,
  type DashboardShop,
  type SellerDashboardInput,
} from "@/lib/seller-dashboard";

const NOW = new Date("2026-09-15T12:00:00.000Z");
const SELLER = "seller-1";
const BUYER = "buyer-1";

function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

function daysFromNow(days: number) {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

function shop(overrides: Partial<DashboardShop> = {}): DashboardShop {
  return {
    id: 1,
    name: "Casa Niebla",
    slug: "casa-niebla",
    image_path: null,
    delivery_policy: null,
    is_publishing_approved: true,
    publishing_reviewed_at: "2026-09-01T00:00:00.000Z",
    listing_limit: 15,
    is_premium: false,
    trust_tier: "standard",
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

let nextProductId = 1;
function product(overrides: Partial<DashboardProduct> = {}): DashboardProduct {
  const id = nextProductId++;
  return {
    id,
    shop_id: 1,
    name: `Jarra ${id}`,
    description: "Jarra de barro hecha a mano en el taller.",
    price_mxn: 450,
    image_path: `products/${id}.png`,
    status: "published",
    expires_at: daysFromNow(20),
    is_admin_enabled: true,
    condition: "new",
    used_condition: null,
    units_available: 1,
    handling_days: 3,
    category_id: 12,
    updated_at: hoursAgo(id),
    ...overrides,
  };
}

function order(overrides: Partial<DashboardOrder> = {}): DashboardOrder {
  return {
    id: 50,
    shop_id: 1,
    status: "requested",
    created_at: hoursAgo(5),
    ship_by_at: null,
    payment_confirmation_required: false,
    payment_completed_at: null,
    fulfillment_method: "pickup",
    item_names: ["Taza Ceniza"],
    ...overrides,
  };
}

function conversation(overrides: Partial<DashboardConversation> = {}): DashboardConversation {
  return {
    id: 70,
    type: "pre_sale",
    order_id: null,
    shop_id: 1,
    product_name: "Jarra de barro",
    last_message: { created_at: hoursAgo(3), sender_id: BUYER },
    ...overrides,
  };
}

function input(overrides: Partial<SellerDashboardInput> = {}): SellerDashboardInput {
  return {
    userId: SELLER,
    now: NOW,
    shopLimit: 2,
    shops: [],
    products: { ok: true, value: [] },
    conversations: { ok: true, value: [] },
    openOrders: { ok: true, value: [] },
    hasCompletedSale: { ok: true, value: false },
    hasAnsweredBuyer: { ok: true, value: false },
    metrics: { ok: true, value: { inquiries: [], purchaseRequests: [], completedOrders: [] } },
    requestedFocusShopId: null,
    ...overrides,
  };
}

function stepState(dashboard: ReturnType<typeof buildSellerDashboard>, id: string) {
  return dashboard.checklist.steps.find((step) => step.id === id)?.state;
}

describe("listing completeness", () => {
  it("accepts a listing with photo, title, price, condition, units and handling time", () => {
    expect(listingGaps(product())).toEqual([]);
  });

  it("names every missing piece a buyer would need", () => {
    const gaps = listingGaps(product({ image_path: null, price_mxn: 0, units_available: 0, category_id: null, condition: "used", used_condition: null }));

    expect(gaps).toEqual(["photo", "price", "condition", "availability", "category"]);
    expect(describeGaps(["photo", "category"])).toBe("foto y categoría");
  });
});

describe("seller dashboard state", () => {
  it("sends somebody without a shop to create one", () => {
    const dashboard = buildSellerDashboard(input());

    expect(dashboard.primary).toMatchObject({ kind: "create_shop", action: { href: "/panel/tiendas/nueva" } });
    expect(stepState(dashboard, "create_shop")).toBe("todo");
    expect(dashboard.mode).toBe("first_sale");
  });

  it("does not offer a shop the account may not create", () => {
    const dashboard = buildSellerDashboard(input({ shopLimit: 0 }));

    expect(dashboard.primary.kind).toBe("shop_limit");
    expect(dashboard.primary.action).toBeNull();
  });

  it("asks an empty shop for its first product", () => {
    const dashboard = buildSellerDashboard(input({ shops: [shop()] }));

    expect(dashboard.primary).toMatchObject({ kind: "add_first_product", action: { href: "/panel/tiendas/1/productos/nuevo" } });
    expect(stepState(dashboard, "create_shop")).toBe("done");
  });

  it("points at the draft that still needs finishing, and says what it lacks", () => {
    const draft = product({ status: "draft", image_path: null, expires_at: null, name: "Canasta tejida" });
    const dashboard = buildSellerDashboard(input({ shops: [shop()], products: { ok: true, value: [draft] } }));

    expect(dashboard.primary).toMatchObject({
      kind: "finish_listing",
      title: "Termina Canasta tejida",
      detail: "Le falta foto.",
      action: { href: `/panel/productos/${draft.id}/editar` },
    });
  });

  it("asks for delivery terms once something is on view", () => {
    const dashboard = buildSellerDashboard(input({ shops: [shop()], products: { ok: true, value: [product()] } }));

    expect(dashboard.primary).toMatchObject({ kind: "configure_delivery", action: { href: "/panel/tiendas/1/ajustes#delivery-policy-title" } });
  });

  it("lets a shop with one complete listing start sharing: three is guidance, not a gate", () => {
    const dashboard = buildSellerDashboard(
      input({ shops: [shop({ delivery_policy: "Entrega en Cholula." })], products: { ok: true, value: [product()] } }),
    );

    expect(dashboard.primary).toMatchObject({ kind: "share_shop", share: { slug: "casa-niebla" } });
    expect(stepState(dashboard, "publish_listings")).toBe("todo");
    expect(dashboard.checklist.steps.find((step) => step.id === "publish_listings")?.detail).toContain("1 de 3");
  });

  it("ticks the listing step at three complete public listings", () => {
    const dashboard = buildSellerDashboard(
      input({ shops: [shop({ delivery_policy: "Envío en 3 días." })], products: { ok: true, value: [product(), product(), product()] } }),
    );

    expect(stepState(dashboard, "publish_listings")).toBe("done");
    expect(stepState(dashboard, "delivery")).toBe("done");
  });

  it("does not count a published listing without a photo as complete", () => {
    const dashboard = buildSellerDashboard(
      input({ shops: [shop()], products: { ok: true, value: [product(), product(), product({ image_path: null })] } }),
    );

    expect(dashboard.shops[0]).toMatchObject({ publicListingCount: 3, readyListingCount: 2 });
  });

  it("never ticks sharing, because nothing proves it happened", () => {
    const dashboard = buildSellerDashboard(
      input({
        shops: [shop({ delivery_policy: "Entrega en Cholula." })],
        products: { ok: true, value: [product(), product(), product()] },
        hasAnsweredBuyer: { ok: true, value: true },
      }),
    );

    expect(stepState(dashboard, "share")).toBe("suggestion");
    expect(dashboard.checklist.total).toBe(5);
    expect(dashboard.checklist.completed).toBe(4);
  });

  it("explains a shop waiting for approval instead of telling the seller to share it", () => {
    const dashboard = buildSellerDashboard(
      input({ shops: [shop({ is_publishing_approved: false, publishing_reviewed_at: null })], products: { ok: true, value: [product()] } }),
    );

    expect(dashboard.primary.kind).toBe("awaiting_approval");
    expect(dashboard.primary.share).toBeNull();
  });

  it("puts a waiting buyer ahead of setup guidance", () => {
    const dashboard = buildSellerDashboard(input({ shops: [shop()], conversations: { ok: true, value: [conversation()] } }));

    expect(dashboard.primary).toMatchObject({ kind: "respond", action: { href: "/mensajes/70" } });
    expect(dashboard.attention).toHaveLength(1);
    expect(stepState(dashboard, "first_reply")).toBe("todo");
    expect(dashboard.checklist.steps.find((step) => step.id === "first_reply")?.action?.href).toBe("/mensajes/70");
  });

  it("puts a pending purchase request first of all", () => {
    const dashboard = buildSellerDashboard(
      input({ shops: [shop()], conversations: { ok: true, value: [conversation()] }, openOrders: { ok: true, value: [order()] } }),
    );

    expect(dashboard.attention.map((item) => item.kind)).toEqual(["purchase_request", "buyer_waiting"]);
    expect(dashboard.primary).toMatchObject({ kind: "review_request", action: { href: "/panel/pedidos/50" } });
  });

  it("treats a thread where the seller had the last word as answered", () => {
    const answered = conversation({ last_message: { created_at: hoursAgo(1), sender_id: SELLER } });
    const dashboard = buildSellerDashboard(input({ shops: [shop()], conversations: { ok: true, value: [answered] } }));

    expect(dashboard.attention).toEqual([]);
  });

  it("ignores buyer messages under orders that are no longer open", () => {
    const thanks = conversation({ id: 71, type: "order", order_id: 60, product_name: null });
    const dashboard = buildSellerDashboard(
      input({ shops: [shop()], conversations: { ok: true, value: [thanks] }, openOrders: { ok: true, value: [] } }),
    );

    expect(buyerIsWaiting(thanks, SELLER, new Set())).toBe(false);
    expect(dashboard.attention).toEqual([]);
  });

  it("asks the seller to hand over an accepted order, or to confirm payment first", () => {
    const dashboard = buildSellerDashboard(
      input({
        shops: [shop()],
        openOrders: {
          ok: true,
          value: [
            order({ id: 51, status: "accepted", ship_by_at: daysFromNow(2) }),
            order({ id: 52, status: "accepted", payment_confirmation_required: true }),
            order({ id: 53, status: "shipped" }),
          ],
        },
      }),
    );

    expect(dashboard.attention.map((item) => (item.kind === "fulfill_order" ? item.step : item.kind))).toEqual(["confirm_payment", "hand_over"]);
  });

  it("replaces the first-sale guide with ongoing tasks after a completed order", () => {
    const dashboard = buildSellerDashboard(
      input({
        shops: [shop({ delivery_policy: "Entrega en Cholula." })],
        products: { ok: true, value: [product(), product({ status: "expired", expires_at: hoursAgo(10) })] },
        hasCompletedSale: { ok: true, value: true },
      }),
    );

    expect(dashboard.mode).toBe("ongoing");
    expect(dashboard.ongoing.map((task) => task.id)).toEqual(["expired-1"]);
    expect(dashboard.primary).toMatchObject({ kind: "keep_selling", title: "Renueva publicaciones vencidas" });
  });

  it("keeps several shops' tasks and counts apart", () => {
    const shops = [
      shop({ id: 1, name: "Taller Niebla", slug: "taller-niebla", created_at: "2026-08-20T00:00:00.000Z" }),
      shop({ id: 2, name: "Cerámica Ceniza", slug: "ceramica-ceniza", delivery_policy: "Envío en 3 días." }),
    ];
    const dashboard = buildSellerDashboard(
      input({
        shops,
        products: { ok: true, value: [product({ shop_id: 1 }), product({ shop_id: 1 }), product({ shop_id: 2 })] },
        conversations: { ok: true, value: [conversation({ shop_id: 1 }), conversation({ id: 99, shop_id: 3 })] },
        openOrders: { ok: true, value: [order({ shop_id: 2 })] },
        metrics: {
          ok: true,
          value: {
            inquiries: [{ shop_id: 1 }, { shop_id: 1 }],
            purchaseRequests: [{ shop_id: 2 }, { shop_id: 3 }],
            completedOrders: [],
          },
        },
      }),
    );

    expect(dashboard.attention.map((item) => [item.kind, item.shop.name])).toEqual([
      ["purchase_request", "Cerámica Ceniza"],
      ["buyer_waiting", "Taller Niebla"],
    ]);
    // The guide follows the shop closest to selling unless another is picked.
    expect(dashboard.checklist.shop?.name).toBe("Taller Niebla");
    expect(buildSellerDashboard(input({ shops, requestedFocusShopId: 2 })).checklist.shop?.name).toBe("Cerámica Ceniza");
    expect(buildSellerDashboard(input({ shops, requestedFocusShopId: 404 })).checklist.shop).not.toBeNull();

    expect(dashboard.metrics).toMatchObject({
      ok: true,
      total: { inquiries: 2, purchaseRequests: 1, completedOrders: 0 },
      byShop: [
        { shop: { name: "Taller Niebla" }, counts: { inquiries: 2, purchaseRequests: 0 } },
        { shop: { name: "Cerámica Ceniza" }, counts: { inquiries: 0, purchaseRequests: 1 } },
      ],
    });
  });
});

describe("honest gaps", () => {
  it("reports unreadable results as unavailable, never as zero", () => {
    const dashboard = buildSellerDashboard(input({ shops: [shop()], metrics: { ok: false } }));

    expect(dashboard.metrics.ok).toBe(false);
  });

  it("does not guess at setup steps when the catalogue could not be read", () => {
    const dashboard = buildSellerDashboard(input({ shops: [shop()], products: { ok: false } }));

    expect(dashboard.primary.kind).toBe("listings_unavailable");
    expect(dashboard.unavailable.listings).toBe(true);
  });

  it("marks conversation-based steps unknown when they could not be checked", () => {
    const dashboard = buildSellerDashboard(
      input({ shops: [shop()], conversations: { ok: false }, hasAnsweredBuyer: { ok: false }, hasCompletedSale: { ok: false } }),
    );

    expect(dashboard.unavailable.attention).toBe(true);
    expect(stepState(dashboard, "first_reply")).toBe("unknown");
    expect(stepState(dashboard, "first_sale")).toBe("unknown");
    expect(dashboard.mode).toBe("unknown");
  });
});

describe("formatWaiting", () => {
  it("speaks in the unit a seller thinks in", () => {
    expect(formatWaiting(hoursAgo(0), NOW)).toBe("hace un momento");
    expect(formatWaiting(new Date(NOW.getTime() - 25 * 60_000).toISOString(), NOW)).toBe("hace 25 min");
    expect(formatWaiting(hoursAgo(3), NOW)).toBe("hace 3 h");
    expect(formatWaiting(hoursAgo(26), NOW)).toBe("hace 1 día");
    expect(formatWaiting(hoursAgo(80), NOW)).toBe("hace 3 días");
  });
});
