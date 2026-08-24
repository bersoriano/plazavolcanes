import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
const removeChannel = vi.fn();

const setAuth = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    channel: () => channel,
    removeChannel,
    realtime: { setAuth },
    auth: { getSession: async () => ({ data: { session: { access_token: "token-1" } } }) },
  }),
}));
vi.mock("@/lib/actions/messages", () => ({ markConversationRead: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { MessageThread } from "@/components/messages/message-thread";

const messages = [
  { id: 1, sender_id: "me", body: "Hola", created_at: "2026-08-23T10:00:00Z" },
  { id: 2, sender_id: "them", body: "¿Sigue disponible?", created_at: "2026-08-23T11:00:00Z" },
];

beforeEach(() => {
  channel.on.mockClear();
  channel.subscribe.mockClear();
  removeChannel.mockClear();
  setAuth.mockClear();
  refresh.mockClear();
});

/** The subscription is set up after an await, so tests wait for it to land. */
async function subscribed() {
  await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalled());
}

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

test("hands the session to realtime before subscribing", async () => {
  renderThread();
  await subscribed();

  // Realtime authorizes each subscriber against the row-level policy. Without
  // the session it subscribes as anon and receives nothing.
  expect(setAuth).toHaveBeenCalledWith("token-1");
});

test("subscribes to new messages in this conversation only", async () => {
  renderThread();
  await subscribed();

  expect(channel.on).toHaveBeenCalledWith(
    "postgres_changes",
    expect.objectContaining({ event: "INSERT", table: "messages", filter: "conversation_id=eq.7" }),
    expect.any(Function),
  );
});

test("appends a message that arrives over the socket", async () => {
  renderThread();
  await subscribed();

  const handler = channel.on.mock.calls[0][2];
  handler({ new: { id: 3, sender_id: "them", body: "Sí, hay", created_at: "2026-08-23T12:00:00Z" } });

  expect(await screen.findByText("Sí, hay")).toBeInTheDocument();
});

test("ignores a message it already shows", async () => {
  renderThread();
  await subscribed();

  const handler = channel.on.mock.calls[0][2];
  handler({ new: messages[1] });

  expect(await screen.findAllByText("¿Sigue disponible?")).toHaveLength(1);
});

test("lets go of the channel when the thread closes", async () => {
  const { unmount } = renderThread();
  await subscribed();
  unmount();

  expect(removeChannel).toHaveBeenCalled();
});

test("keeps asking the server while the subscription is settling", async () => {
  renderThread();
  await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalled());

  vi.useFakeTimers();

  try {
    // A subscription reports SUBSCRIBED before the server has registered it, so
    // a message sent into that gap arrives over no socket at all.
    const onStatus = channel.subscribe.mock.calls[0][0];
    await act(async () => {
      onStatus("SUBSCRIBED");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(refresh).toHaveBeenCalled();

    // And it stops once the window has passed, rather than polling for as long
    // as the thread stays open.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(40_000);
    });
    refresh.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(refresh).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});
