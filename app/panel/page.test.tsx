import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSellerDashboard,
  type DashboardProduct,
  type DashboardShop,
  type SellerDashboardInput,
} from "@/lib/seller-dashboard";

const mocks = vi.hoisted(() => ({ getSellerDashboard: vi.fn() }));

vi.mock("@/lib/queries/seller-dashboard.server", () => ({ getSellerDashboard: mocks.getSellerDashboard }));

const { default: PanelPage } = await import("@/app/panel/page");

const NOW = new Date("2026-09-15T12:00:00.000Z");

const shop: DashboardShop = {
  id: 1,
  name: "Casa Niebla",
  slug: "casa-niebla",
  image_path: null,
  delivery_policy: "Entrega en Cholula.",
  is_publishing_approved: true,
  publishing_reviewed_at: "2026-08-01T00:00:00.000Z",
  listing_limit: 10,
  is_premium: false,
  trust_tier: "standard",
  created_at: "2026-08-01T00:00:00.000Z",
};

function listing(id: number, shopId = 1): DashboardProduct {
  return {
    id,
    shop_id: shopId,
    name: `Jarra ${id}`,
    description: "Jarra de barro hecha a mano en el taller.",
    price_mxn: 450,
    image_path: `products/${id}.png`,
    status: "published",
    expires_at: "2026-10-01T00:00:00.000Z",
    is_admin_enabled: true,
    condition: "new",
    used_condition: null,
    units_available: 1,
    handling_days: 3,
    category_id: 12,
    updated_at: "2026-09-10T00:00:00.000Z",
  };
}

function ready(overrides: Partial<SellerDashboardInput> = {}) {
  return {
    status: "ready" as const,
    now: NOW,
    shopImageUrls: new Map<string, string>(),
    dashboard: buildSellerDashboard({
      userId: "seller-1",
      now: NOW,
      shopLimit: 1,
      shops: [shop],
      products: { ok: true, value: [listing(1)] },
      conversations: { ok: true, value: [] },
      openOrders: { ok: true, value: [] },
      hasCompletedSale: { ok: true, value: false },
      hasAnsweredBuyer: { ok: true, value: false },
      metrics: { ok: true, value: { inquiries: [], purchaseRequests: [], completedOrders: [] } },
      requestedFocusShopId: null,
      ...overrides,
    }),
  };
}

async function renderPanel(search: Record<string, string> = {}) {
  render(await PanelPage({ searchParams: Promise.resolve(search) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSellerDashboard.mockResolvedValue(ready());
});

afterEach(cleanup);

describe("PanelPage", () => {
  it("leads with the next step, before general store management", async () => {
    await renderPanel();

    const next = screen.getByRole("region", { name: "Comparte tu tienda" });
    const shops = screen.getByRole("region", { name: "Mis tiendas" });
    expect(next.compareDocumentPosition(shops) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The share controls share the public shop, not the private panel.
    expect(within(next).getByRole("link", { name: "Compartir por WhatsApp" }).getAttribute("href")).toContain(
      encodeURIComponent("/tiendas/casa-niebla"),
    );
  });

  it("shows a waiting buyer above the first-sale guide", async () => {
    mocks.getSellerDashboard.mockResolvedValue(
      ready({
        conversations: {
          ok: true,
          value: [{ id: 70, type: "pre_sale", order_id: null, shop_id: 1, product_name: "Jarra 1", last_message: { created_at: "2026-09-15T09:00:00.000Z", sender_id: "buyer-1" } }],
        },
      }),
    );

    await renderPanel();

    const attention = screen.getByRole("region", { name: "Requiere tu atención" });
    const guide = screen.getByRole("region", { name: "Prepara Casa Niebla" });
    expect(within(attention).getByRole("link", { name: /Pregunta sobre Jarra 1/ })).toHaveAttribute("href", "/mensajes/70");
    expect(within(attention).getByText("Escribió hace 3 h")).toBeInTheDocument();
    expect(attention.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const next = screen.getByRole("region", { name: "Responde al comprador" });
    expect(within(next).getByRole("link", { name: "Responder" })).toHaveAttribute("href", "/mensajes/70");
  });

  it("swaps the guide for ongoing tasks once a sale is complete", async () => {
    mocks.getSellerDashboard.mockResolvedValue(ready({ hasCompletedSale: { ok: true, value: true } }));

    await renderPanel();

    expect(screen.getByRole("region", { name: "Mantén tus tiendas al día" })).toBeInTheDocument();
    expect(screen.queryByText("Tu primera venta")).not.toBeInTheDocument();
  });

  it("marks visits as not measured and never invents a conversion rate", async () => {
    await renderPanel();

    const results = screen.getByRole("region", { name: "Últimos 30 días" });
    expect(within(results).getByText("Sin medir")).toBeInTheDocument();
    expect(within(results).queryByText(/%/)).not.toBeInTheDocument();
  });

  it("says results are unavailable instead of showing zeros", async () => {
    mocks.getSellerDashboard.mockResolvedValue(ready({ metrics: { ok: false } }));

    await renderPanel();

    expect(screen.getAllByText("No disponible")).toHaveLength(3);
  });

  it("breaks results down per shop for a seller with several", async () => {
    const second = { ...shop, id: 2, name: "Cerámica Ceniza", slug: "ceramica-ceniza" };
    mocks.getSellerDashboard.mockResolvedValue(
      ready({
        shopLimit: 3,
        shops: [shop, second],
        metrics: { ok: true, value: { inquiries: [{ shop_id: 2 }], purchaseRequests: [], completedOrders: [] } },
      }),
    );

    await renderPanel();

    const byShop = within(screen.getByRole("list", { name: "Resultados por tienda" })).getAllByRole("listitem");
    expect(byShop.map((row) => row.textContent)).toEqual([
      "Casa Niebla0 consultas · 0 solicitudes · 0 completados",
      "Cerámica Ceniza1 consulta · 0 solicitudes · 0 completados",
    ]);
    expect(screen.getByRole("navigation", { name: "Tienda que sigue la guía" })).toBeInTheDocument();
  });

  it("keeps the catalogue, settings, public shop, orders and account reachable", async () => {
    await renderPanel();

    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/panel/tiendas/1");
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveAttribute("href", "/panel/tiendas/1/ajustes");
    expect(screen.getByRole("link", { name: "Tienda pública" })).toHaveAttribute("href", "/tiendas/casa-niebla");
    expect(screen.getByRole("link", { name: "Pedidos" })).toHaveAttribute("href", "/panel/pedidos");
    expect(screen.getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/panel/cuenta");
    expect(screen.getByText("1 de 10 publicaciones · Nivel Estándar")).toBeInTheDocument();
  });

  it("passes only a well-formed shop id through to the dashboard", async () => {
    await renderPanel({ tienda: "2" });
    expect(mocks.getSellerDashboard).toHaveBeenLastCalledWith({ requestedFocusShopId: 2 });

    cleanup();
    await renderPanel({ tienda: "2; drop" });
    expect(mocks.getSellerDashboard).toHaveBeenLastCalledWith({ requestedFocusShopId: null });
  });

  it("shows an error with a way to retry when the panel cannot be read", async () => {
    mocks.getSellerDashboard.mockResolvedValue({ status: "error" });

    await renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tu panel");
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute("href", "/panel");
  });
});

describe("PanelPage shop limit", () => {
  it("hides shop creation and explains when the limit is reached", async () => {
    await renderPanel();

    expect(screen.queryByRole("link", { name: "Crear tienda" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Alcanzaste tu límite de 1 tienda. Contacta a administración si necesitas otra."),
    ).toBeInTheDocument();
  });

  it("keeps shop creation available below the limit", async () => {
    mocks.getSellerDashboard.mockResolvedValue(ready({ shopLimit: 2 }));

    await renderPanel();

    expect(screen.getByRole("link", { name: "Crear tienda" })).toHaveAttribute("href", "/panel/tiendas/nueva");
  });

  it("makes creating a shop the next step for a new seller", async () => {
    mocks.getSellerDashboard.mockResolvedValue(ready({ shops: [], products: { ok: true, value: [] } }));

    await renderPanel();

    expect(screen.getByRole("region", { name: "Crea tu tienda" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Crear tienda/ })[0]).toHaveAttribute("href", "/panel/tiendas/nueva");
    expect(screen.queryByRole("region", { name: "Últimos 30 días" })).not.toBeInTheDocument();
  });

  it("explains a zero limit instead of offering a shop", async () => {
    mocks.getSellerDashboard.mockResolvedValue(ready({ shopLimit: 0, shops: [], products: { ok: true, value: [] } }));

    await renderPanel();

    expect(screen.getByRole("region", { name: "Aún no puedes crear tiendas" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Crear tienda/ })).not.toBeInTheDocument();
  });
});
