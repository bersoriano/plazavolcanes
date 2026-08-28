import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MessagesPage from "@/app/mensajes/page";
import type { ConversationSummary } from "@/lib/queries/messages";
import { listConversations } from "@/lib/queries/messages.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));
vi.mock("@/lib/queries/messages.server", () => ({ listConversations: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

const sellerConversation: ConversationSummary = {
  id: 7,
  type: "pre_sale",
  order_id: null,
  shop_id: 3,
  shop_name: "Taller Volcán",
  shop_slug: "taller-volcan",
  counterpart_label: "Ana Ruiz",
  product: null,
  unread_count: 2,
  last_message: {
    body: "¿Sigue disponible?",
    created_at: "2026-08-23T10:00:00Z",
    sender_id: "buyer-id",
  },
};

const buyerConversation: ConversationSummary = {
  ...sellerConversation,
  id: 11,
  shop_id: 5,
  shop_name: "Casa Niebla",
  shop_slug: "casa-niebla",
  counterpart_label: "Casa Niebla",
  unread_count: 1,
};

let ownedShops: { id: number }[];

beforeEach(() => {
  ownedShops = [{ id: 3 }];
  vi.mocked(listConversations).mockImplementation(async (role) =>
    role === "seller" ? [sellerConversation] : [buyerConversation],
  );
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getClaims: vi.fn(async () => ({ data: { claims: { sub: "user-id" } }, error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(async () => ({ data: ownedShops, error: null })),
        })),
      })),
    })),
  } as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("unified messages inbox", () => {
  it("separates selling and shopping conversations under one route", async () => {
    render(await MessagesPage());

    const selling = screen.getByRole("region", { name: "Mis tiendas y publicaciones" });
    const shopping = screen.getByRole("region", { name: "Mis compras" });

    expect(within(selling).getByRole("link", { name: /Ana Ruiz/ })).toHaveAttribute(
      "href",
      "/mensajes/7",
    );
    expect(within(shopping).getByRole("link", { name: /Casa Niebla/ })).toHaveAttribute(
      "href",
      "/mensajes/11",
    );
  });

  it("hides shop messages when user owns no shop", async () => {
    ownedShops = [];

    render(await MessagesPage());

    expect(
      screen.queryByRole("region", { name: "Mis tiendas y publicaciones" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Mis compras" })).toBeInTheDocument();
    expect(screen.queryByText("Ana Ruiz")).not.toBeInTheDocument();
  });

  it("keeps shop section visible with a useful empty state", async () => {
    vi.mocked(listConversations).mockImplementation(async (role) =>
      role === "seller" ? [] : [buyerConversation],
    );

    render(await MessagesPage());

    const selling = screen.getByRole("region", { name: "Mis tiendas y publicaciones" });
    expect(within(selling).getByText(/consultas sobre tus tiendas aparecerán aquí/i)).toBeVisible();
  });
});
