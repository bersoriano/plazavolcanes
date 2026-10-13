import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MessageThreadPage from "@/app/mensajes/[id]/page";
import { sendMessage } from "@/lib/actions/messages";
import { fetchThread } from "@/lib/queries/messages.server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/components/messages/thread-conversation", () => ({
  ThreadConversation: ({ conversationId }: { conversationId: number }) => (
    <p>conversación {conversationId}</p>
  ),
}));
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
  order_item: null,
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

  it("refreshes the seller's action queue after a reply", async () => {
    // The page binds the action to its thread and the pages a reply refreshes.
    const bind = vi.spyOn(sendMessage as unknown as { bind: (...args: unknown[]) => unknown }, "bind");

    render(await MessageThreadPage({ params: Promise.resolve({ id: "7" }) }));

    expect(bind).toHaveBeenCalledWith(null, 7, ["/mensajes/7", "/mensajes", "/panel"]);
  });

  it("leaves the seller queue alone when a buyer replies", async () => {
    vi.mocked(fetchThread).mockResolvedValue({ ...thread, viewer_role: "buyer" });
    const bind = vi.spyOn(sendMessage as unknown as { bind: (...args: unknown[]) => unknown }, "bind");

    render(await MessageThreadPage({ params: Promise.resolve({ id: "7" }) }));

    expect(bind).toHaveBeenCalledWith(null, 7, ["/mensajes/7", "/mensajes"]);
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

describe("unified message thread pane", () => {
  it("heads the pane with the counterpart and shows the conversation", async () => {
    render(await MessageThreadPage({ params: Promise.resolve({ id: "7" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Ana Ruiz" })).toBeInTheDocument();
    expect(screen.getByText("conversación 7")).toBeInTheDocument();
  });

  it("reads a thread the caller is not part of as missing", async () => {
    vi.mocked(fetchThread).mockResolvedValue(null);

    await expect(MessageThreadPage({ params: Promise.resolve({ id: "7" }) })).rejects.toThrow(
      "NOT_FOUND",
    );
  });

  it("reads an address that is not a conversation number as missing", async () => {
    await expect(MessageThreadPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toThrow(
      "NOT_FOUND",
    );
    expect(fetchThread).not.toHaveBeenCalled();
  });
});
