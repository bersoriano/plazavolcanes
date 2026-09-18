import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const getPublicShop = vi.fn();

let conversationButtonProps: Record<string, unknown> = {};

vi.mock("@/lib/queries/catalog.server", () => ({ getPublicShop }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => false }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/actions/start-conversation", () => ({ openConversation: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/components/messages/start-conversation-button", () => ({
  StartConversationButton: (props: Record<string, unknown>) => {
    conversationButtonProps = props;
    return null;
  },
}));

const { default: PublicShopPage } = await import("@/app/tiendas/[slug]/page");
const { openConversation } = await import("@/lib/actions/start-conversation");

const shop = {
  id: 4,
  name: "Casa Niebla",
  slug: "casa-niebla",
  description: "Tienda de barro y textiles.",
  image_path: null,
  owner_id: "seller-1",
  country_code: "MX",
  administrative_area_codes: [],
  trust_tier: "standard" as const,
  trust_metrics: { status: "pending" as const },
  trust_profile: null,
  products: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  conversationButtonProps = {};
  getPublicShop.mockResolvedValue(shop);
});

afterEach(cleanup);

async function renderPage() {
  return render(await PublicShopPage({ params: Promise.resolve({ slug: "casa-niebla" }) }));
}

test("opens the general enquiry, with no product attached", async () => {
  await renderPage();

  const action = conversationButtonProps.action as (
    state: unknown,
    formData: FormData,
  ) => Promise<unknown>;
  const forged = new FormData();
  forged.set("product_id", "999");
  await action({ status: "idle", message: "" }, forged);

  expect(openConversation).toHaveBeenCalledWith(4, null, null, expect.anything(), forged);
});

test("returns a signed-out visitor to the shop they asked from", async () => {
  await renderPage();

  expect(conversationButtonProps.returnTo).toBe("/tiendas/casa-niebla");
});

test("keeps a pending shop reachable while its published products are withheld", async () => {
  const pendingShopPublishedProduct = { slug: "taza-pendiente", name: "Taza pendiente" };
  const catalogDouble = (filters: { isAdminEnabled?: boolean; isShopApproved?: boolean }) =>
    filters.isAdminEnabled === true && filters.isShopApproved === true
      ? []
      : [pendingShopPublishedProduct];
  const effectiveProducts = catalogDouble({ isAdminEnabled: true, isShopApproved: true });
  expect(catalogDouble({ isAdminEnabled: true })).toEqual([pendingShopPublishedProduct]);
  getPublicShop.mockResolvedValue({
    ...shop,
    is_publishing_approved: false,
    products: effectiveProducts,
  });

  await renderPage();

  expect(screen.getByRole("heading", { name: "Casa Niebla" })).toBeInTheDocument();
  expect(screen.getByText("Esta tienda prepara su catálogo")).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: new RegExp(pendingShopPublishedProduct.name) }),
  ).not.toBeInTheDocument();
});

test("shows the delivery policy the shop published", async () => {
  getPublicShop.mockResolvedValue({
    ...shop,
    delivery_policy: "Envío por paquetería en 3 días.\nEntrego en persona los sábados.",
  });

  await renderPage();

  expect(screen.getByRole("heading", { name: "Política de entregas" })).toBeInTheDocument();
  expect(screen.getByText(/Envío por paquetería en 3 días/)).toBeInTheDocument();
});

test("says nothing about entregas when the shop has written no policy", async () => {
  getPublicShop.mockResolvedValue({ ...shop, delivery_policy: null });

  await renderPage();

  expect(screen.queryByRole("heading", { name: "Política de entregas" })).not.toBeInTheDocument();
});

test("shows a distinguished shop in its own premium room", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: true });

  const { container } = await renderPage();

  expect(container.querySelector('[data-theme="premium"]')).not.toBeNull();
  expect(screen.getByTestId("premium-badge")).toBeInTheDocument();
});

test("leaves an ordinary shop in the ordinary theme", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: false });

  const { container } = await renderPage();

  expect(container.querySelector('[data-theme="premium"]')).toBeNull();
  expect(screen.queryByTestId("premium-badge")).toBeNull();
});

test("keeps the granted distinction apart from the earned history", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: true });

  await renderPage();

  // Premium says who granted it, without waiting for a hover.
  expect(screen.getByTestId("premium-note")).toHaveTextContent(
    "Distinción otorgada por Plaza Volcanes.",
  );
  // And the history is stated separately, as its own fact.
  expect(screen.getByTestId("selling-history")).toHaveTextContent(
    "Historial de ventas: está construyendo su historial",
  );
});

test("shows no starting-tier rank competing with the distinction", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: true });

  await renderPage();

  expect(screen.queryByText(/Nivel Estándar/)).toBeNull();
  expect(screen.queryByTestId("reputation-badge")).toBeNull();
});

test("shows an earned tier, because that one a buyer can use", async () => {
  getPublicShop.mockResolvedValue({ ...shop, is_premium: true, trust_tier: "top_rated" });

  await renderPage();

  expect(screen.getByTestId("reputation-badge")).toHaveTextContent("Mejor valorada");
  expect(screen.getByTestId("premium-badge")).toBeInTheDocument();
});

test("tells a failed metrics read apart from a shop with no history", async () => {
  getPublicShop.mockResolvedValue({ ...shop, trust_metrics: { status: "unavailable" } });

  await renderPage();

  expect(screen.getByTestId("selling-history")).toHaveTextContent("no disponible por ahora");
  expect(screen.getByTestId("selling-history")).toHaveTextContent(/Vuelve a cargar/);
  // Nothing is shown as measured when nothing could be read.
  expect(screen.queryByRole("list", { name: "Marcadores de confianza" })).toBeNull();
});

test("never shows a zero response rate the plaza never measured", async () => {
  getPublicShop.mockResolvedValue({
    ...shop,
    trust_metrics: {
      status: "ready",
      metrics: {
        averageReplyTimeMinutes: null,
        responseRate: null,
        descriptionAccuracy: null,
        onTimeShippingRate: null,
        orderCompletionRate: null,
        disputeRate: null,
        totalOrders: 0,
        averageRating: null,
        reviewCount: 0,
        lastActiveDaysAgo: null,
        sellerActiveDaysAgo: null,
        evaluatedAt: "2026-09-01T00:00:00.000Z",
      },
    },
  });

  await renderPage();

  const badge = screen.getByTestId("trust-badge-response_rate");
  expect(badge).toHaveTextContent("Sin historial de respuesta");
  expect(badge.textContent).not.toMatch(/0\s*%/);
});
