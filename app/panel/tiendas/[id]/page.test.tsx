import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ShopManagePage from "@/app/panel/tiendas/[id]/page";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/queries/trust.server", () => ({ getShopTrustDashboard: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/actions/shops", () => ({
  deleteShop: vi.fn(),
  updateShop: vi.fn(),
  updateDeliveryPolicy: vi.fn(),
}));
vi.mock("@/components/shops/shop-form", () => ({ ShopForm: () => null }));

let deliveryPolicyProps: Record<string, unknown> = {};
vi.mock("@/components/shops/delivery-policy-form", () => ({
  DeliveryPolicyForm: (props: Record<string, unknown>) => {
    deliveryPolicyProps = props;
    return null;
  },
}));

afterEach(cleanup);

function chained(result: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}

describe("seller pickup point read", () => {
  it("does not render an unchecked form when the pickup SELECT fails", async () => {
    const shopQuery = chained({
      data: {
        id: 4,
        owner_id: "seller-1",
        name: "Casa Niebla",
        slug: "casa-niebla",
        description: "Objetos hechos en un taller al pie del volcán.",
        image_path: null,
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
      },
      error: null,
    });
    const pickupQuery = chained({
      data: null,
      error: { message: "connection reset" },
    });
    const productsQuery = chained({ data: [], error: null });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "seller-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "shops") return shopQuery;
        if (table === "shop_pickup_points") return pickupQuery;
        return productsQuery;
      }),
    } as never);

    await expect(
      ShopManagePage({ params: Promise.resolve({ id: "4" }) }),
    ).rejects.toThrow("No pudimos consultar el punto de recolección.");
  });

  it.each([
    [null, "Esperando aprobación de administración"],
    ["2026-08-29T00:00:00.000Z", "Tienda deshabilitada por administración"],
  ] as const)("renders a reviewed-at %s shop with effective state %s", async (publishingReviewedAt, label) => {
    const shopQuery = chained({
      data: {
        id: 4,
        owner_id: "seller-1",
        name: "Casa Niebla",
        slug: "casa-niebla",
        description: "Objetos hechos en un taller al pie del volcán.",
        image_path: null,
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
        is_publishing_approved: false,
        publishing_reviewed_at: publishingReviewedAt,
      },
      error: null,
    });
    const pickupQuery = chained({ data: null, error: null });
    const productsQuery = chained({
      data: [{
        id: 9,
        name: "Taza de barro",
        price_mxn: 480,
        image_path: null,
        status: "published",
        expires_at: null,
        is_admin_enabled: true,
      }],
      error: null,
    });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "seller-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "shops") return shopQuery;
        if (table === "shop_pickup_points") return pickupQuery;
        return productsQuery;
      }),
    } as never);

    render(await ShopManagePage({ params: Promise.resolve({ id: "4" }) }));

    expect(productsQuery.select).toHaveBeenCalledWith("id, name, price_mxn, image_path, status, expires_at, is_admin_enabled");
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("shop workspace layout", () => {
  function renderShop() {
    const shopQuery = chained({
      data: {
        id: 4,
        owner_id: "seller-1",
        name: "Casa Niebla",
        slug: "casa-niebla",
        description: "Objetos hechos en un taller al pie del volcán.",
        image_path: null,
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
        is_publishing_approved: true,
        publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
      },
      error: null,
    });
    const pickupQuery = chained({ data: null, error: null });
    const productsQuery = chained({ data: [], error: null });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "seller-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "shops") return shopQuery;
        if (table === "shop_pickup_points") return pickupQuery;
        return productsQuery;
      }),
    } as never);

    return ShopManagePage({ params: Promise.resolve({ id: "4" }) });
  }

  it("names the page after the shop", async () => {
    render(await renderShop());

    expect(screen.getByRole("heading", { level: 1, name: "Casa Niebla" })).toBeInTheDocument();
  });

  it("puts the catalogue ahead of the shop settings", async () => {
    // Adding and checking listings is the daily errand; the shop's own details
    // are edited once in a while, so the catalogue reads first and sits left.
    render(await renderShop());

    const catalogue = screen.getByRole("heading", { level: 2, name: "Productos" });
    const settings = screen.getByRole("heading", { level: 2, name: "Editar tienda" });

    expect(catalogue.compareDocumentPosition(settings)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("folds the shop settings away until they are asked for", async () => {
    render(await renderShop());

    const settings = screen
      .getByRole("heading", { level: 2, name: "Editar tienda" })
      .closest("details");

    expect(settings).toHaveClass("disclosure-mobile");
    // Closed in the markup: a phone opens it on a tap, a wide screen shows it
    // anyway, so the panel never depends on JavaScript to be reachable.
    expect(settings).not.toHaveAttribute("open");
    expect(settings?.querySelector("summary")).toHaveTextContent("Editar tienda");
  });

  it("keeps the delete confirmation inside the settings panel", async () => {
    render(await renderShop());

    const settings = screen
      .getByRole("heading", { level: 2, name: "Editar tienda" })
      .closest("details");

    expect(within(settings as HTMLElement).getByText("Eliminar tienda")).toBeInTheDocument();
  });
});

describe("delivery policy panel", () => {
  function renderShopWith(policy: string | null, policyUpdatedAt: string | null) {
    deliveryPolicyProps = {};
    const shopQuery = chained({
      data: {
        id: 4,
        owner_id: "seller-1",
        name: "Casa Niebla",
        slug: "casa-niebla",
        description: "Objetos hechos en un taller al pie del volcán.",
        image_path: null,
        country_code: "MX",
        administrative_area_codes: ["MX-JAL"],
        is_publishing_approved: true,
        publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
        delivery_policy: policy,
        delivery_policy_updated_at: policyUpdatedAt,
      },
      error: null,
    });
    const pickupQuery = chained({ data: null, error: null });
    const productsQuery = chained({ data: [], error: null });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "seller-1" } } }) },
      from: vi.fn((table: string) => {
        if (table === "shops") return shopQuery;
        if (table === "shop_pickup_points") return pickupQuery;
        return productsQuery;
      }),
    } as never);

    return ShopManagePage({ params: Promise.resolve({ id: "4" }) });
  }

  it("opens the field for a shop that never wrote a policy", async () => {
    render(await renderShopWith(null, null));

    expect(deliveryPolicyProps.policy).toBe("");
    expect(deliveryPolicyProps.unlocksAt).toBeNull();
  });

  it("shuts the field for a shop that wrote one this month", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    render(await renderShopWith("Entrego los sábados.", yesterday.toISOString()));

    expect(deliveryPolicyProps.policy).toBe("Entrego los sábados.");
    expect(deliveryPolicyProps.unlocksAt).toBe(
      new Date(yesterday.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("opens the field again once the month has passed", async () => {
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    render(await renderShopWith("Entrego los sábados.", longAgo.toISOString()));

    expect(deliveryPolicyProps.unlocksAt).toBeNull();
  });
});
