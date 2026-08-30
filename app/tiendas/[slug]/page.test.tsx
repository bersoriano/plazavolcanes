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
