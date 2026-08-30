import { cleanup, render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CartPage from "@/app/carrito/[shopId]/page";
import { CartThreads } from "@/components/orders/cart-thread";
import { openConversation } from "@/lib/actions/start-conversation";
import { getPublicShop } from "@/lib/queries/catalog.server";
import {
  fetchBuyerProfile,
  fetchCartThreads,
  fetchPickupPoint,
} from "@/lib/queries/checkout.server";
import { getCart, type CartDetail } from "@/lib/queries/orders.server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/cart", () => ({
  checkoutCart: vi.fn(),
  removeCartItem: vi.fn(),
  setCartItemQuantity: vi.fn(),
}));
vi.mock("@/lib/actions/messages", () => ({ sendMessage: vi.fn(), markConversationRead: vi.fn() }));
vi.mock("@/lib/actions/start-conversation", () => ({ openConversation: vi.fn() }));
vi.mock("@/lib/queries/catalog.server", () => ({ getPublicShop: vi.fn() }));
vi.mock("@/lib/queries/checkout.server", () => ({
  fetchBuyerProfile: vi.fn(),
  fetchCartThreads: vi.fn(),
  fetchPickupPoint: vi.fn(),
}));
vi.mock("@/lib/queries/orders.server", () => ({ getCart: vi.fn() }));

const cart: CartDetail = {
  id: 20,
  shop: { id: 4, name: "Casa Niebla", slug: "casa-niebla" },
  items: [
    {
      id: 31,
      productId: 12,
      quantity: 2,
      product: {
        id: 12,
        name: "Taza volcánica",
        price_mxn: 240,
        image_path: null,
      },
    },
  ],
  subtotal: 480,
};

function elementsOfType(node: ReactNode, type: typeof CartThreads) {
  const matches: ReactElement<Record<string, unknown>>[] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === type) matches.push(child);
    matches.push(...elementsOfType(child.props.children as ReactNode, type));
  });

  return matches;
}

beforeEach(() => {
  vi.mocked(getCart).mockResolvedValue(cart);
  vi.mocked(fetchBuyerProfile).mockResolvedValue({
    userId: "buyer-1",
    displayName: "Ana Ruiz",
    email: "ana@example.com",
    phone: "+523312345678",
  });
  vi.mocked(fetchPickupPoint).mockResolvedValue({
    locality: "Guadalajara",
    administrative_area_code: "JAL",
  });
  vi.mocked(fetchCartThreads).mockResolvedValue([
    {
      productId: 12,
      productName: "Taza volcánica",
      conversationId: null,
      messages: [],
    },
  ]);
  vi.mocked(getPublicShop).mockResolvedValue({
    id: 4,
    name: "Casa Niebla",
    slug: "casa-niebla",
    administrative_area_codes: ["JAL"],
    country_code: "MX",
    created_at: "2026-08-01T12:00:00Z",
    description: "Barro y cerámica local.",
    image_path: null,
    imageUrl: null,
    is_publishing_approved: true,
    publishing_reviewed_at: "2026-08-29T00:00:00.000Z",
    listing_limit: 50,
    owner_id: "seller-1",
    seller_display_name: "Vendedor #SELL",
    time_zone: "America/Mexico_City",
    trust_evaluated_at: null,
    trust_tier: "standard",
    trust_metrics: null,
    trust_profile: null,
    updated_at: "2026-08-01T12:00:00Z",
    products: [],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("cart purchase request", () => {
  it("renders buyer, items and threads, and seller in the required responsive grid", async () => {
    const { container } = render(
      await CartPage({ params: Promise.resolve({ shopId: "4" }) }),
    );

    expect(screen.getByRole("heading", { name: "Carrito de Casa Niebla" })).toBeInTheDocument();
    expect(screen.getByText("Taza volcánica")).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Vendedor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entrega" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conversación" })).toBeInTheDocument();

    const grid = container.querySelector(
      ".lg\\:grid-cols-\\[minmax\\(0\\,340px\\)_minmax\\(0\\,1fr\\)_minmax\\(0\\,320px\\)\\]",
    );
    expect(grid).not.toBeNull();
    expect(grid?.children).toHaveLength(3);
    expect(grid?.children[0]).toHaveClass("contents", "lg:block");
    expect(grid?.children[0]).toContainElement(screen.getByText("Ana Ruiz"));
    expect(grid?.children[1]).toHaveClass("contents", "lg:block");
    expect(grid?.children[1]).toContainElement(screen.getByText("Taza volcánica"));
    expect(grid?.children[1]).toContainElement(screen.getByRole("heading", { name: "Conversación" }));
    expect(grid?.children[2]).toHaveClass("contents", "lg:block");
    expect(grid?.children[2]).toContainElement(screen.getByText("Vendedor"));

    expect(screen.getByText("Taza volcánica").closest(".order-1")).not.toBeNull();
    expect(screen.getByText("Vendedor").closest(".order-2")).not.toBeNull();
    expect(screen.getByText("Ana Ruiz").closest(".order-3")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Conversación" }).closest(".order-4"),
    ).not.toBeNull();
  });

  it("offers one explicit thread action through a responsive disclosure without opening one on render", async () => {
    render(await CartPage({ params: Promise.resolve({ shopId: "4" }) }));

    expect(screen.getAllByRole("button", { name: "Preguntar sobre este producto" })).toHaveLength(1);
    expect(screen.getByLabelText("Ver mensajes")).not.toBeChecked();
    expect(fetchCartThreads).toHaveBeenCalledWith(4, [
      { productId: 12, productName: "Taza volcánica" },
    ]);
    expect(openConversation).not.toHaveBeenCalled();
  });

  it("passes only concrete per-thread actions across the client boundary", async () => {
    const page = await CartPage({ params: Promise.resolve({ shopId: "4" }) });
    const boundaries = elementsOfType(page, CartThreads);

    expect(boundaries).toHaveLength(1);
    for (const boundary of boundaries) {
      expect(boundary.props.sendAction).toBeUndefined();
      expect(boundary.props.startAction).toBeUndefined();

      const [thread] = boundary.props.threads as Array<Record<string, unknown>>;
      expect(thread.startAction).toBeTypeOf("function");
      expect(thread.sendAction).toBeNull();
    }
  });

  it("keeps hidden cart rows removable and blocks checkout until they are removed", async () => {
    vi.mocked(getCart).mockResolvedValue({
      ...cart,
      items: [
        ...cart.items,
        { id: 32, quantity: 1, product: null },
      ],
      subtotal: 480,
    } as CartDetail);

    render(await CartPage({ params: Promise.resolve({ shopId: "4" }) }));

    expect(screen.getByText("Ya no disponible")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Quitar" })).toHaveLength(2);
    expect(screen.getByText("Quita los productos no disponibles antes de continuar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar solicitud" })).not.toBeInTheDocument();
    expect(fetchCartThreads).toHaveBeenCalledWith(4, [
      { productId: 12, productName: "Taza volcánica" },
    ]);
  });

  it("renders the seller, stored shop location and positive trust context without a pickup point", async () => {
    vi.mocked(fetchPickupPoint).mockResolvedValue(null);
    vi.mocked(getPublicShop).mockResolvedValue({
      id: 4,
      name: "Casa Niebla",
      slug: "casa-niebla",
      administrative_area_codes: ["MX-JAL"],
      country_code: "MX",
      created_at: "2026-08-01T12:00:00Z",
      description: "Barro y cerámica local.",
      image_path: "seller/shops/casa-niebla.jpg",
      imageUrl: "/casa-niebla.jpg",
      listing_limit: 40,
      owner_id: "seller-1",
      seller_display_name: "Elena Volcán",
      time_zone: "America/Mexico_City",
      trust_evaluated_at: "2026-08-27T12:00:00Z",
      trust_tier: "reliable",
      trust_metrics: {
        averageReplyTimeMinutes: 45,
        responseRate: 98,
        descriptionAccuracy: 97,
        onTimeShippingRate: 96,
        orderCompletionRate: 99,
        disputeRate: 0,
        totalOrders: 32,
        averageRating: 4.8,
        reviewCount: 20,
        lastActiveDaysAgo: 1,
        sellerActiveDaysAgo: 1,
        evaluatedAt: "2026-08-27T12:00:00Z",
      },
      trust_profile: { joined_on: "2025-01-15", verification_level: "basic" },
      updated_at: "2026-08-01T12:00:00Z",
      products: [],
    } as never);

    render(await CartPage({ params: Promise.resolve({ shopId: "4" }) }));

    expect(screen.getByText("Elena Volcán")).toBeInTheDocument();
    expect(screen.getByText("Jalisco, México")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Casa Niebla" })).toHaveAttribute(
      "src",
      "/casa-niebla.jpg",
    );
    expect(screen.getByText("Nivel Confiable")).toBeInTheDocument();
    expect(screen.getByTestId("trust-badge-membership")).toHaveAttribute(
      "data-state",
      "measured",
    );
    expect(screen.getByTestId("trust-badge-response_rate")).toHaveTextContent("98%");
  });
});
