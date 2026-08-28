import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/actions/messages", () => ({ markConversationRead: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    channel: () => ({ on: () => ({ subscribe: () => undefined }) }),
    realtime: { setAuth: vi.fn() },
    auth: { getSession: async () => ({ data: { session: null } }) },
  }),
}));

import { CartThreads } from "@/components/orders/cart-thread";
import type { ActionState } from "@/lib/action-state";

const noop = async (): Promise<ActionState> => ({ status: "idle", message: "" });

const threads = [
  {
    productId: 1,
    productName: "Taza de barro",
    conversationId: 10,
    messages: [{ id: 1, sender_id: "u1", body: "¿Sigue disponible?", created_at: "2026-08-27T10:00:00Z" }],
    sendAction: noop,
    startAction: null,
  },
  {
    productId: 2,
    productName: "Plato de barro",
    conversationId: null,
    messages: [],
    sendAction: null,
    startAction: noop,
  },
];

afterEach(cleanup);

describe("CartThreads", () => {
  it("opens on the first item's thread", () => {
    render(<CartThreads currentUserId="u1" threads={threads} />);

    const firstTab = screen.getByRole("tab", { name: "Taza de barro" });
    const secondTab = screen.getByRole("tab", { name: "Plato de barro" });
    const panel = screen.getByRole("tabpanel");

    expect(firstTab).toHaveAttribute("aria-selected", "true");
    expect(firstTab).toHaveAttribute("aria-controls", "cart-thread-panel-1");
    expect(firstTab).toHaveAttribute("tabindex", "0");
    expect(secondTab).toHaveAttribute("aria-controls", "cart-thread-panel-2");
    expect(secondTab).toHaveAttribute("tabindex", "-1");
    expect(panel).toHaveAttribute("id", "cart-thread-panel-1");
    expect(panel).toHaveAttribute("aria-labelledby", "cart-thread-tab-1");
    expect(document.getElementById("cart-thread-panel-2")).toHaveAttribute("hidden");
    expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
  });

  it("switches to another item's thread", () => {
    render(<CartThreads currentUserId="u1" threads={threads} />);

    fireEvent.click(screen.getByRole("tab", { name: "Plato de barro" }));

    expect(screen.getByRole("tab", { name: "Plato de barro" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("¿Sigue disponible?")).not.toBeInTheDocument();
  });

  it("offers to start a thread that does not exist yet", () => {
    render(<CartThreads currentUserId="u1" threads={threads} />);

    fireEvent.click(screen.getByRole("tab", { name: "Plato de barro" }));

    expect(screen.getByRole("button", { name: "Preguntar sobre este producto" })).toBeInTheDocument();
  });

  it("moves selection and focus with the tab arrow keys", () => {
    render(<CartThreads currentUserId="u1" threads={threads} />);

    const firstTab = screen.getByRole("tab", { name: "Taza de barro" });
    const secondTab = screen.getByRole("tab", { name: "Plato de barro" });
    firstTab.focus();

    fireEvent.keyDown(firstTab, { key: "ArrowRight" });

    expect(secondTab).toHaveFocus();
    expect(secondTab).toHaveAttribute("aria-selected", "true");
    expect(secondTab).toHaveAttribute("tabindex", "0");
    expect(firstTab).toHaveAttribute("tabindex", "-1");
  });

  it("shows no tab strip for a single item", () => {
    render(<CartThreads currentUserId="u1" threads={[threads[0]]} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
  });
});
