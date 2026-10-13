import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { ThreadConversation } from "@/components/messages/thread-conversation";
import type { ActionState } from "@/lib/action-state";
import { markConversationRead } from "@/lib/actions/messages";
import { subscribeToMessageInserts } from "@/lib/realtime-messages";

const refresh = vi.fn();
// One router for the life of the page, as the real hook hands out.
const router = { refresh };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/messages", () => ({ markConversationRead: vi.fn(async () => undefined) }));
vi.mock("@/lib/realtime-messages", () => ({ subscribeToMessageInserts: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/use-viewer-time-zone", () => ({ useViewerTimeZone: () => "America/Mexico_City" }));

const NOW = "2026-10-12T23:00:00Z";

const messages = [
  // Yesterday evening and this morning, in Mexico City.
  { id: 1, sender_id: "me", body: "¿Sigue disponible?", created_at: "2026-10-11T23:15:00Z" },
  { id: 2, sender_id: "them", body: "Sí, hay dos", created_at: "2026-10-12T16:42:00Z" },
];

const scrollIntoView = vi.fn();

beforeEach(() => {
  // Absent in jsdom.
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderConversation(overrides: Partial<Parameters<typeof ThreadConversation>[0]> = {}) {
  return render(
    <ThreadConversation
      action={vi.fn(async (): Promise<ActionState> => ({ status: "success", message: "Mensaje enviado." }))}
      conversationId={7}
      currentUserId="me"
      messages={messages}
      now={NOW}
      {...overrides}
    />,
  );
}

const log = () => screen.getByRole("log", { name: "Conversación" });
const bubble = (text: string) => within(log()).getByText(text).parentElement;

test("shows the history inside a conversation log", () => {
  renderConversation();

  expect(within(log()).getByText("¿Sigue disponible?")).toBeInTheDocument();
  expect(within(log()).getByText("Sí, hay dos")).toBeInTheDocument();
});

test("sets the reader's messages apart from the counterpart's", () => {
  renderConversation();

  expect(bubble("¿Sigue disponible?")).toHaveClass("ml-auto", "bg-brand");
  expect(bubble("Sí, hay dos")).not.toHaveClass("ml-auto");
});

test("heads each day of messages once", () => {
  renderConversation({
    messages: [
      ...messages,
      { id: 3, sender_id: "me", body: "Perfecto", created_at: "2026-10-12T17:00:00Z" },
    ],
  });

  expect(within(log()).getAllByText("Ayer")).toHaveLength(1);
  expect(within(log()).getAllByText("Hoy")).toHaveLength(1);
});

test("tells the time each message was sent", () => {
  renderConversation();

  expect(within(log()).getByText("10:42 a.m.")).toBeInTheDocument();
});

test("invites a first message when the thread is empty", () => {
  renderConversation({ messages: [] });

  expect(screen.getByText(/aún no hay mensajes/i)).toBeInTheDocument();
});

test("offers a labelled message box and a send button", () => {
  renderConversation();

  const box = screen.getByLabelText("Mensaje", { exact: true });
  expect(box).toHaveAttribute("name", "body");
  expect(box).toBeRequired();
  expect(box).toHaveAttribute("maxlength", "2000");
  expect(screen.getByRole("button", { name: "Enviar mensaje" })).toHaveAttribute("type", "submit");
});

test("says why a message was refused and keeps what was typed", async () => {
  renderConversation({
    action: async () => ({ status: "error", message: "No pudimos enviar el mensaje." }),
  });

  fireEvent.change(screen.getByLabelText("Mensaje", { exact: true }), {
    target: { value: "Hola de nuevo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

  expect(await screen.findByRole("status")).toHaveTextContent("No pudimos enviar el mensaje.");
  expect(screen.getByLabelText("Mensaje", { exact: true })).toHaveValue("Hola de nuevo");
});

test("lets the sent message speak for itself", async () => {
  const action = vi.fn(async (): Promise<ActionState> => ({ status: "success", message: "Mensaje enviado." }));
  renderConversation({ action });

  fireEvent.change(screen.getByLabelText("Mensaje", { exact: true }), { target: { value: "Hola" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

  await waitFor(() => expect(action).toHaveBeenCalled());
  expect(screen.queryByText("Mensaje enviado.")).not.toBeInTheDocument();
});

test("hands the box back to the writer after sending", async () => {
  const action = vi.fn(async (): Promise<ActionState> => ({ status: "success", message: "Mensaje enviado." }));
  renderConversation({ action });

  fireEvent.change(screen.getByLabelText("Mensaje", { exact: true }), { target: { value: "Hola" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

  await waitFor(() => expect(screen.getByLabelText("Mensaje", { exact: true })).toHaveFocus());
});

test("appends a message that arrives while the thread is open", async () => {
  renderConversation();

  const { onInsert } = vi.mocked(subscribeToMessageInserts).mock.calls[0][0];
  act(() => {
    onInsert({ id: 3, sender_id: "them", body: "Te la aparto", created_at: "2026-10-12T18:00:00Z" });
  });

  expect(await within(log()).findByText("Te la aparto")).toBeInTheDocument();
});

test("brings the newest message into view, and only when there is a new one", async () => {
  const { rerender } = renderConversation();
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

  // A refresh hands over the same history in a new array.
  rerender(
    <ThreadConversation
      action={vi.fn()}
      conversationId={7}
      currentUserId="me"
      messages={[...messages]}
      now={NOW}
    />,
  );
  expect(scrollIntoView).toHaveBeenCalledTimes(1);

  const { onInsert } = vi.mocked(subscribeToMessageInserts).mock.calls[0][0];
  act(() => {
    onInsert({ id: 3, sender_id: "them", body: "Te la aparto", created_at: "2026-10-12T18:00:00Z" });
  });
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
});

test("tells the inbox once the counterpart's message has been read", async () => {
  renderConversation();

  await waitFor(() => expect(markConversationRead).toHaveBeenCalledWith(7, 2));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
});

test("has nothing to tell the inbox when the newest message is the reader's own", async () => {
  renderConversation({ messages: [messages[0]] });

  await waitFor(() => expect(markConversationRead).toHaveBeenCalledWith(7, 1));
  expect(refresh).not.toHaveBeenCalled();
});

test("moves only the conversation when it scrolls inside the inbox frame", async () => {
  renderConversation();
  await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

  // From `lg` the log is its own scroller. Bringing a message into view through
  // the page would drag the whole frame under the site header.
  log().style.overflowY = "auto";
  Object.defineProperty(log(), "scrollHeight", { configurable: true, value: 900 });

  const { onInsert } = vi.mocked(subscribeToMessageInserts).mock.calls[0][0];
  act(() => {
    onInsert({ id: 3, sender_id: "them", body: "Te la aparto", created_at: "2026-10-12T18:00:00Z" });
  });

  await waitFor(() => expect(log().scrollTop).toBe(900));
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});
