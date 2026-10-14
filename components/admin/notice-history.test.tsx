import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NoticeHistory } from "@/components/admin/notice-history";
import type { NoticeBatch } from "@/lib/queries/platform-notices";

const { retractNotice } = vi.hoisted(() => ({ retractNotice: vi.fn() }));

vi.mock("@/lib/actions/platform-notices", () => ({ retractNotice }));

const announcement: NoticeBatch = {
  id: "20000000-0000-4000-8000-000000000001",
  audience: "everyone",
  recipientLabel: null,
  title: "Mantenimiento el sábado",
  body: "La plaza estará en pausa.",
  action: null,
  recipientCount: 214,
  readCount: 131,
  createdAt: "2026-10-12T16:42:00Z",
  retractedAt: null,
};

const direct: NoticeBatch = {
  ...announcement,
  id: "20000000-0000-4000-8000-000000000002",
  audience: "person",
  recipientLabel: "Ana Ruiz",
  title: "Tu tienda necesita portada",
  recipientCount: 1,
  readCount: 1,
};

const retracted: NoticeBatch = {
  ...announcement,
  id: "20000000-0000-4000-8000-000000000003",
  audience: "sellers",
  title: "Nuevas categorías",
  retractedAt: "2026-10-03T12:00:00Z",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(retractNotice).mockResolvedValue({ status: "success", message: "Aviso retirado." });
});

// By its heading: the title is also read out inside the row's retract button.
const entry = (title: string) => screen.getByRole("heading", { name: title }).closest("li")!;

describe("NoticeHistory", () => {
  it("says so when nothing has been sent", () => {
    render(<NoticeHistory batches={[]} />);

    expect(screen.getByText("Aún no se ha enviado nada.")).toBeInTheDocument();
  });

  it("shows who an announcement reached and how many have read it", () => {
    render(<NoticeHistory batches={[announcement]} />);

    const row = within(entry("Mantenimiento el sábado"));
    expect(row.getByText("Todas las personas · 214 enviados · 131 leídos")).toBeInTheDocument();
    expect(row.getByText("12 de octubre de 2026")).toBeInTheDocument();
    expect(row.getByText("La plaza estará en pausa.")).toBeInTheDocument();
  });

  it("counts one person in the singular", () => {
    render(<NoticeHistory batches={[{ ...announcement, recipientCount: 1, readCount: 1 }]} />);

    expect(
      within(entry("Mantenimiento el sábado")).getByText("Todas las personas · 1 enviado · 1 leído"),
    ).toBeInTheDocument();
  });

  it("names each audience in words", () => {
    render(
      <NoticeHistory
        batches={[
          { ...announcement, id: "a", audience: "sellers", title: "Para quienes venden" },
          { ...announcement, id: "b", audience: "buyers", title: "Para quienes compran" },
        ]}
      />,
    );

    expect(within(entry("Para quienes venden")).getByText(/^Quienes venden ·/)).toBeInTheDocument();
    expect(within(entry("Para quienes compran")).getByText(/^Quienes solo compran ·/)).toBeInTheDocument();
  });

  it("shows who a direct notice went to and whether they read it", () => {
    render(<NoticeHistory batches={[direct, { ...direct, id: "c", title: "Sin abrir", readCount: 0 }]} />);

    expect(within(entry("Tu tienda necesita portada")).getByText("Ana Ruiz · Leído")).toBeInTheDocument();
    expect(within(entry("Sin abrir")).getByText("Ana Ruiz · Sin leer")).toBeInTheDocument();
  });

  it("says when the person a notice went to is gone", () => {
    render(<NoticeHistory batches={[{ ...direct, recipientLabel: null }]} />);

    expect(within(entry("Tu tienda necesita portada")).getByText(/^Cuenta eliminada ·/)).toBeInTheDocument();
  });

  it("shows the link a notice carried", () => {
    render(
      <NoticeHistory batches={[{ ...direct, action: { href: "/panel", label: "Ir a mi panel" } }]} />,
    );

    expect(within(entry("Tu tienda necesita portada")).getByText("Ir a mi panel → /panel")).toBeInTheDocument();
  });

  it("marks a retracted send and offers nothing more to do with it", () => {
    render(<NoticeHistory batches={[retracted]} />);

    const row = within(entry("Nuevas categorías"));
    expect(row.getByText("Quienes venden · Retirado el 3 de octubre de 2026")).toBeInTheDocument();
    expect(row.queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks before retracting, and retracts exactly that send", async () => {
    render(<NoticeHistory batches={[announcement, direct]} />);

    const row = within(entry("Mantenimiento el sábado"));
    fireEvent.click(row.getByRole("button", { name: "Retirar Mantenimiento el sábado" }));
    expect(retractNotice).not.toHaveBeenCalled();
    expect(row.getByText(/Se quitará de todas las bandejas/)).toBeInTheDocument();

    fireEvent.click(row.getByRole("button", { name: "Retirar definitivamente" }));

    await waitFor(() => expect(retractNotice).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(retractNotice).mock.calls[0]?.[1] as FormData;
    expect(submitted.get("batch_id")).toBe(announcement.id);
  });

  it("can step back from retracting", () => {
    render(<NoticeHistory batches={[announcement]} />);

    const row = within(entry("Mantenimiento el sábado"));
    fireEvent.click(row.getByRole("button", { name: "Retirar Mantenimiento el sábado" }));
    fireEvent.click(row.getByRole("button", { name: "Cancelar" }));

    expect(row.queryByText(/Se quitará de todas las bandejas/)).not.toBeInTheDocument();
    expect(retractNotice).not.toHaveBeenCalled();
  });

  it("says why a retraction was refused", async () => {
    vi.mocked(retractNotice).mockResolvedValue({ status: "error", message: "No pudimos retirar el aviso." });
    render(<NoticeHistory batches={[announcement]} />);

    const row = within(entry("Mantenimiento el sábado"));
    fireEvent.click(row.getByRole("button", { name: "Retirar Mantenimiento el sábado" }));
    fireEvent.click(row.getByRole("button", { name: "Retirar definitivamente" }));

    expect(await row.findByRole("status")).toHaveTextContent("No pudimos retirar el aviso.");
  });
});
