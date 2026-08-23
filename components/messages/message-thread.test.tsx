import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
const removeChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ channel: () => channel, removeChannel }),
}));
vi.mock("@/lib/actions/messages", () => ({ markConversationRead: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { MessageThread } from "@/components/messages/message-thread";

const messages = [
  { id: 1, sender_id: "me", body: "Hola", created_at: "2026-08-23T10:00:00Z" },
  { id: 2, sender_id: "them", body: "¿Sigue disponible?", created_at: "2026-08-23T11:00:00Z" },
];

beforeEach(() => {
  channel.on.mockClear();
  channel.subscribe.mockClear();
  removeChannel.mockClear();
});

afterEach(cleanup);

function renderThread(overrides: Partial<Parameters<typeof MessageThread>[0]> = {}) {
  return render(
    <MessageThread
      action={vi.fn()}
      conversationId={7}
      currentUserId="me"
      messages={messages}
      {...overrides}
    />,
  );
}

test("renders the history the server provided", () => {
  renderThread();

  expect(screen.getByText("Hola")).toBeInTheDocument();
  expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
});

test("invites a first message when the thread is empty", () => {
  renderThread({ messages: [] });

  expect(screen.getByText(/aún no hay mensajes/i)).toBeInTheDocument();
});

test("subscribes to new messages in this conversation only", () => {
  renderThread();

  expect(channel.on).toHaveBeenCalledWith(
    "postgres_changes",
    expect.objectContaining({ event: "INSERT", table: "messages", filter: "conversation_id=eq.7" }),
    expect.any(Function),
  );
});

test("appends a message that arrives over the socket", async () => {
  renderThread();

  const handler = channel.on.mock.calls[0][2];
  handler({ new: { id: 3, sender_id: "them", body: "Sí, hay", created_at: "2026-08-23T12:00:00Z" } });

  expect(await screen.findByText("Sí, hay")).toBeInTheDocument();
});

test("ignores a message it already shows", async () => {
  renderThread();

  const handler = channel.on.mock.calls[0][2];
  handler({ new: messages[1] });

  expect(await screen.findAllByText("¿Sigue disponible?")).toHaveLength(1);
});

test("lets go of the channel when the thread closes", () => {
  const { unmount } = renderThread();
  unmount();

  expect(removeChannel).toHaveBeenCalled();
});
