import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { NoticeView } from "@/components/messages/notice-view";
import { markPlatformNoticeRead } from "@/lib/actions/platform-notices";
import type { PlatformNotice } from "@/lib/queries/platform-notices";

const refresh = vi.fn();
// One router for the life of the page, as the real hook hands out.
const router = { refresh };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/platform-notices", () => ({
  markPlatformNoticeRead: vi.fn(async () => undefined),
}));
vi.mock("@/lib/use-viewer-time-zone", () => ({ useViewerTimeZone: () => "America/Mexico_City" }));

const NOW = "2026-10-12T23:00:00Z";

const notice: PlatformNotice = {
  id: 12,
  kind: "announcement",
  title: "Mantenimiento el sábado por la noche",
  body: "La plaza estará en pausa de 11 p.m. a 1 a.m.\nTus publicaciones y pedidos no cambian.",
  action: { href: "/panel", label: "Ver mi panel" },
  created_at: "2026-10-12T16:42:00Z",
  read_at: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderNotice = (overrides: Partial<PlatformNotice> = {}) =>
  render(<NoticeView notice={{ ...notice, ...overrides }} now={NOW} />);

test("signs the page as Plaza Volcanes, and titles the notice below it", () => {
  renderNotice();

  expect(screen.getByRole("heading", { level: 1, name: "Plaza Volcanes" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { level: 2, name: "Mantenimiento el sábado por la noche" }),
  ).toBeInTheDocument();
});

test("says whether it was written to everyone or to the reader alone", () => {
  const { unmount } = renderNotice();
  expect(screen.getByText("Anuncio")).toBeInTheDocument();
  unmount();

  renderNotice({ kind: "direct" });
  expect(screen.getByText("Aviso")).toBeInTheDocument();
});

test("says when it was sent", () => {
  renderNotice();

  expect(screen.getByText("Hoy · 10:42 a.m.")).toBeInTheDocument();
});

test("keeps the message as it was written, line breaks included", () => {
  renderNotice();

  const body = screen.getByText(/La plaza estará en pausa/);
  expect(body.textContent).toBe(notice.body);
  expect(body).toHaveClass("whitespace-pre-wrap");
});

test("never turns text in the message into a link", () => {
  renderNotice({ body: "Entra a https://evil.test/premio para reclamar.", action: null });

  expect(screen.queryByRole("link", { name: /evil/ })).not.toBeInTheDocument();
});

test("offers the notice's button when it has one", () => {
  renderNotice();

  expect(screen.getByRole("link", { name: "Ver mi panel" })).toHaveAttribute("href", "/panel");
});

test("shows no button for a notice without a link", () => {
  renderNotice({ action: null });

  expect(screen.queryByRole("link", { name: "Ver mi panel" })).not.toBeInTheDocument();
});

test("offers no way to answer, and says where to turn instead", () => {
  renderNotice();

  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /enviar/i })).not.toBeInTheDocument();
  expect(screen.getByText(/no admite respuesta/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Quejas y aclaraciones" })).toHaveAttribute(
    "href",
    "/quejas-y-aclaraciones",
  );
});

test("leads back to the list", () => {
  renderNotice();

  expect(screen.getByRole("link", { name: "Volver a mensajes" })).toHaveAttribute("href", "/mensajes");
});

test("marks an unread notice read once, then tells the inbox", async () => {
  const { rerender } = renderNotice();

  await waitFor(() => expect(markPlatformNoticeRead).toHaveBeenCalledWith(12));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

  // The refresh hands the same notice back, now read.
  rerender(<NoticeView notice={{ ...notice, read_at: NOW }} now={NOW} />);
  expect(markPlatformNoticeRead).toHaveBeenCalledTimes(1);
});

test("leaves a notice that was already read alone", async () => {
  renderNotice({ read_at: "2026-10-12T17:00:00Z" });

  expect(markPlatformNoticeRead).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});
