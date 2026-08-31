import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getClaims: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
const { default: PanelPage } = await import("@/app/panel/page");

const shop = {
  administrative_area_codes: ["MX-PUE"],
  country_code: "MX",
  created_at: "2026-08-01T00:00:00.000Z",
  description: "Objetos hechos en un taller al pie del volcán.",
  id: 1,
  image_path: null,
  is_publishing_approved: true,
  publishing_reviewed_at: "2026-08-01T00:00:00.000Z",
  listing_limit: 10,
  name: "Casa Niebla",
  owner_id: "seller-1",
  slug: "casa-niebla",
  time_zone: "America/Mexico_City",
  trust_evaluated_at: null,
  trust_tier: "standard" as const,
  updated_at: "2026-08-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "seller-1" } } });
  mocks.order.mockResolvedValue({ data: [shop], count: 1, error: null });
  mocks.rpc.mockResolvedValue({ data: 1, error: null });
  mocks.select.mockReturnValue({
    eq: vi.fn().mockReturnValue({ order: mocks.order }),
  });
  mocks.createServerSupabaseClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
    from: vi.fn().mockReturnValue({
      select: mocks.select,
    }),
    rpc: mocks.rpc,
  });
});

afterEach(cleanup);

describe("PanelPage shop limit", () => {
  it("hides shop creation links and explains when current limit is reached", async () => {
    render(await PanelPage());

    expect(mocks.select).toHaveBeenCalledWith("*", { count: "exact" });
    expect(screen.queryByRole("link", { name: "Crear tienda" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Alcanzaste tu límite de 1 tienda. Contacta a administración si necesitas otra."),
    ).toBeInTheDocument();
  });

  it("keeps shop creation available below current limit", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 2, error: null });

    render(await PanelPage());

    expect(screen.getByRole("link", { name: "Crear tienda" })).toHaveAttribute(
      "href",
      "/panel/tiendas/nueva",
    );
  });

  it("uses exact count when shop rows exceed Data API page limit", async () => {
    mocks.order.mockResolvedValueOnce({ data: [shop], count: 1_001, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: 1_001, error: null });

    render(await PanelPage());

    expect(screen.queryByRole("link", { name: "Crear tienda" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Alcanzaste tu límite de 1001 tiendas. Contacta a administración si necesitas otra."),
    ).toBeInTheDocument();
  });

  it("shows a capacity-specific empty state when limit is zero", async () => {
    mocks.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
    mocks.rpc.mockResolvedValueOnce({ data: 0, error: null });

    render(await PanelPage());

    expect(screen.getByText("Aún no puedes crear tiendas")).toBeInTheDocument();
    expect(screen.queryByText("Tu primera tienda te espera")).not.toBeInTheDocument();
  });
});
