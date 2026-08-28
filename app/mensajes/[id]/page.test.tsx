import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MessageThreadPage from "@/app/mensajes/[id]/page";
import { fetchThread } from "@/lib/queries/messages.server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/components/messages/message-thread", () => ({ MessageThread: () => null }));
vi.mock("@/lib/actions/messages", () => ({ sendMessage: vi.fn() }));
vi.mock("@/lib/queries/messages.server", () => ({ fetchThread: vi.fn() }));

const thread = {
  id: 7,
  type: "order" as const,
  order_id: 41,
  counterpart_label: "Ana Ruiz",
  shop_name: "Taller Volcán",
  shop_slug: "taller-volcan",
  product: null,
  current_user_id: "user-id",
  messages: [],
};

beforeEach(() => {
  vi.mocked(fetchThread).mockResolvedValue({ ...thread, viewer_role: "seller" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("unified message thread", () => {
  it("links sellers back to seller order details", async () => {
    render(await MessageThreadPage({ params: Promise.resolve({ id: "7" }) }));

    expect(screen.getByRole("link", { name: "Ver el pedido #41" })).toHaveAttribute(
      "href",
      "/panel/pedidos/41",
    );
  });

  it("links buyers back to purchase details", async () => {
    vi.mocked(fetchThread).mockResolvedValue({ ...thread, viewer_role: "buyer" });

    render(await MessageThreadPage({ params: Promise.resolve({ id: "7" }) }));

    expect(screen.getByRole("link", { name: "Ver el pedido #41" })).toHaveAttribute(
      "href",
      "/compras/41",
    );
  });
});
