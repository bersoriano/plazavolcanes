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
const sendAction = () => noop;
const startAction = () => noop;

const threads = [
  {
    productId: 1,
    productName: "Taza de barro",
    conversationId: 10,
    messages: [{ id: 1, sender_id: "u1", body: "¿Sigue disponible?", created_at: "2026-08-27T10:00:00Z" }],
  },
  { productId: 2, productName: "Plato de barro", conversationId: null, messages: [] },
];

afterEach(cleanup);

describe("CartThreads", () => {
  it("opens on the first item's thread", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={threads} />);

    expect(screen.getByRole("tab", { name: "Taza de barro" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
  });

  it("switches to another item's thread", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={threads} />);

    fireEvent.click(screen.getByRole("tab", { name: "Plato de barro" }));

    expect(screen.getByRole("tab", { name: "Plato de barro" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("¿Sigue disponible?")).not.toBeInTheDocument();
  });

  it("offers to start a thread that does not exist yet", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={threads} />);

    fireEvent.click(screen.getByRole("tab", { name: "Plato de barro" }));

    expect(screen.getByRole("button", { name: "Preguntar sobre este producto" })).toBeInTheDocument();
  });

  it("shows no tab strip for a single item", () => {
    render(<CartThreads currentUserId="u1" sendAction={sendAction} startAction={startAction} threads={[threads[0]]} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
  });
});
