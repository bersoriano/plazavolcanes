import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ShopSettingsPage from "@/app/panel/tiendas/[id]/ajustes/page";
import { getOwnedShop } from "@/lib/queries/shops.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  redirect: vi.fn(() => { throw new Error("REDIRECT"); }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/queries/shops.server", () => ({ getOwnedShop: vi.fn() }));
vi.mock("@/lib/actions/shops", () => ({
  deleteShop: vi.fn(),
  updateShop: vi.fn(),
  updateDeliveryPolicy: vi.fn(),
}));
vi.mock("@/components/shops/shop-form", () => ({ ShopForm: () => <div data-testid="shop-form" /> }));

let deliveryPolicyProps: Record<string, unknown> = {};
vi.mock("@/components/shops/delivery-policy-form", () => ({
  DeliveryPolicyForm: (props: Record<string, unknown>) => {
    deliveryPolicyProps = props;
    return null;
  },
}));

afterEach(cleanup);

function shop(overrides: Record<string, unknown> = {}) {
  return {
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
    delivery_policy: null,
    delivery_policy_updated_at: null,
    ...overrides,
  };
}

function mockPickup(result: { data: unknown; error: unknown }) {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result) };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    from: vi.fn().mockReturnValue(query),
  } as never);
}

function renderSettings() {
  return ShopSettingsPage({ params: Promise.resolve({ id: "4" }) });
}

beforeEach(() => {
  deliveryPolicyProps = {};
  vi.clearAllMocks();
  vi.mocked(getOwnedShop).mockResolvedValue(shop() as never);
  mockPickup({ data: null, error: null });
});

describe("shop ownership", () => {
  it("refuses a shop the signed-in user does not own", async () => {
    // The settings are a second door onto the same shop, so they have to carry
    // the same lock the catalogue does.
    vi.mocked(getOwnedShop).mockResolvedValue(null);

    await expect(renderSettings()).rejects.toThrow("NOT_FOUND");
  });
});

describe("seller pickup point read", () => {
  it("does not render an unchecked form when the pickup SELECT fails", async () => {
    mockPickup({ data: null, error: { message: "connection reset" } });

    await expect(renderSettings()).rejects.toThrow("No pudimos consultar el punto de recolección.");
  });
});

describe("the settings view", () => {
  it("marks itself as the open section", async () => {
    render(await renderSettings());

    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute("aria-current", "page");
  });

  it("carries the shop form", async () => {
    render(await renderSettings());

    expect(screen.getByTestId("shop-form")).toBeInTheDocument();
  });

  it("keeps the delete confirmation folded away inside the settings", async () => {
    render(await renderSettings());

    const danger = screen.getByText("Eliminar tienda").closest("details");

    expect(danger).not.toBeNull();
    expect(danger).not.toHaveAttribute("open");
    expect(within(danger as HTMLElement).getByRole("button", { name: "Confirmar eliminación" })).toBeInTheDocument();
  });

  it("leaves the catalogue to its own view", async () => {
    render(await renderSettings());

    expect(screen.queryByRole("navigation", { name: "Estado de las publicaciones" })).not.toBeInTheDocument();
  });
});

describe("delivery policy panel", () => {
  it("opens the field for a shop that never wrote a policy", async () => {
    render(await renderSettings());

    expect(deliveryPolicyProps.policy).toBe("");
    expect(deliveryPolicyProps.unlocksAt).toBeNull();
  });

  it("shuts the field for a shop that wrote one this month", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    vi.mocked(getOwnedShop).mockResolvedValue(shop({
      delivery_policy: "Entrego los sábados.",
      delivery_policy_updated_at: yesterday.toISOString(),
    }) as never);

    render(await renderSettings());

    expect(deliveryPolicyProps.policy).toBe("Entrego los sábados.");
    expect(deliveryPolicyProps.unlocksAt).toBe(
      new Date(yesterday.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
  });

  it("opens the field again once the month has passed", async () => {
    const longAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    vi.mocked(getOwnedShop).mockResolvedValue(shop({
      delivery_policy: "Entrego los sábados.",
      delivery_policy_updated_at: longAgo.toISOString(),
    }) as never);

    render(await renderSettings());

    expect(deliveryPolicyProps.unlocksAt).toBeNull();
  });
});
