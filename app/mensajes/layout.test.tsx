import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MessagesLayout from "@/app/mensajes/layout";
import type { ConversationSummary, InboxEntry } from "@/lib/queries/messages";
import { listConversations } from "@/lib/queries/messages.server";
import { viewerOwnsAnyShop } from "@/lib/queries/seller-standing.server";
import { requireSignedIn } from "@/lib/require-signed-in.server";

vi.mock("@/lib/queries/messages.server", () => ({ listConversations: vi.fn() }));
vi.mock("@/lib/queries/seller-standing.server", () => ({ viewerOwnsAnyShop: vi.fn() }));
vi.mock("@/lib/require-signed-in.server", () => ({ requireSignedIn: vi.fn() }));

type ShellProps = {
  children: React.ReactNode;
  currentUserId: string;
  entries: InboxEntry[];
  now: string;
  showSelling: boolean;
};

let shell: ShellProps;

// The shell has its own suite; here it only reports what the layout handed it.
vi.mock("@/components/messages/inbox-shell", () => ({
  InboxShell: (props: ShellProps) => {
    shell = props;
    return <div>{props.children}</div>;
  },
}));

const sellerConversation: ConversationSummary = {
  id: 7,
  type: "pre_sale",
  order_id: null,
  shop_id: 3,
  shop_name: "Taller Volcán",
  shop_slug: "taller-volcan",
  counterpart_label: "Ana Ruiz",
  product: null,
  order_item: null,
  unread_count: 2,
  last_message: { body: "¿Sigue disponible?", created_at: "2026-08-23T10:00:00Z", sender_id: "buyer-id" },
};

const buyerConversation: ConversationSummary = {
  ...sellerConversation,
  id: 11,
  shop_name: "Casa Niebla",
  counterpart_label: "Casa Niebla",
  last_message: { body: "Hola", created_at: "2026-08-24T10:00:00Z", sender_id: "user-id" },
};

const silentOrder: ConversationSummary = {
  ...buyerConversation,
  id: 21,
  type: "order",
  order_id: 12,
  unread_count: 0,
  last_message: null,
};

beforeEach(() => {
  vi.mocked(requireSignedIn).mockResolvedValue("user-id");
  vi.mocked(viewerOwnsAnyShop).mockResolvedValue(true);
  vi.mocked(listConversations).mockImplementation(async (role) =>
    role === "seller" ? [sellerConversation] : [buyerConversation, silentOrder],
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderLayout = async () => render(await MessagesLayout({ children: <p>conversación abierta</p> }));

describe("messages layout", () => {
  it("asks a signed-out visitor to sign in and come back", async () => {
    vi.mocked(requireSignedIn).mockRejectedValue(new Error("REDIRECT"));

    await expect(MessagesLayout({ children: null })).rejects.toThrow("REDIRECT");
    expect(requireSignedIn).toHaveBeenCalledWith("/mensajes");
    expect(listConversations).not.toHaveBeenCalled();
  });

  it("puts what the reader buys and sells in one inbox, newest first", async () => {
    await renderLayout();

    expect(shell.entries.map((entry) => [entry.id, entry.role])).toEqual([
      [11, "buyer"],
      [7, "seller"],
    ]);
    expect(shell.currentUserId).toBe("user-id");
  });

  it("leaves out an order nobody has written in yet", async () => {
    await renderLayout();

    expect(shell.entries.map((entry) => entry.id)).not.toContain(21);
  });

  it("shows the open conversation inside the inbox", async () => {
    await renderLayout();

    expect(screen.getByText("conversación abierta")).toBeInTheDocument();
  });

  it("offers the selling filter to a shop owner nobody has written to yet", async () => {
    vi.mocked(listConversations).mockImplementation(async (role) =>
      role === "seller" ? [] : [buyerConversation],
    );

    await renderLayout();

    expect(shell.showSelling).toBe(true);
  });

  it("keeps the selling filter for threads that outlived the shop", async () => {
    vi.mocked(viewerOwnsAnyShop).mockResolvedValue(false);

    await renderLayout();

    expect(shell.showSelling).toBe(true);
  });

  it("offers no selling filter to somebody who only buys", async () => {
    vi.mocked(viewerOwnsAnyShop).mockResolvedValue(false);
    vi.mocked(listConversations).mockImplementation(async (role) =>
      role === "seller" ? [] : [buyerConversation],
    );

    await renderLayout();

    expect(shell.showSelling).toBe(false);
  });

  it("hands the shell the moment it rendered", async () => {
    await renderLayout();

    expect(Number.isNaN(Date.parse(shell.now))).toBe(false);
  });
});
