import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserNoticeForm } from "@/components/admin/user-notice-form";
import type { AdminMarketplaceUser } from "@/lib/queries/admin";

const { sendNotice } = vi.hoisted(() => ({ sendNotice: vi.fn() }));

vi.mock("@/lib/actions/platform-notices", () => ({ sendNotice }));

const lucia: AdminMarketplaceUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "lucia@tallervolcan.mx",
  displayName: "Lucía Martínez",
  createdAt: "2026-08-01T00:00:00.000Z",
  shopLimit: 1,
  isDisabled: false,
  isAdmin: false,
  shops: [],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendNotice).mockResolvedValue({ status: "success", message: "Aviso enviado." });
});

const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Enviar aviso a Lucía Martínez" }));

function write() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Tu tienda necesita portada" } });
  fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Agrega una foto." } });
}

describe("UserNoticeForm", () => {
  it("keeps the form folded away until it is asked for", () => {
    render(<UserNoticeForm user={lucia} />);

    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
  });

  it("offers a title, a message, and an optional link with its button text", () => {
    render(<UserNoticeForm user={lucia} />);
    open();

    expect(screen.getByLabelText("Título")).toBeRequired();
    expect(screen.getByLabelText("Mensaje")).toBeRequired();
    expect(screen.getByLabelText(/^Enlace/)).not.toBeRequired();
    expect(screen.getByLabelText(/^Texto del botón/)).not.toBeRequired();
  });

  it("sends the notice to that person and nobody else", async () => {
    render(<UserNoticeForm user={lucia} />);
    open();
    write();
    fireEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));

    await waitFor(() => expect(sendNotice).toHaveBeenCalledTimes(1));
    const submitted = vi.mocked(sendNotice).mock.calls[0]?.[1] as FormData;
    expect(submitted.get("audience")).toBe("person");
    expect(submitted.get("recipient_id")).toBe(lucia.id);
    expect(submitted.get("title")).toBe("Tu tienda necesita portada");
    expect(submitted.get("body")).toBe("Agrega una foto.");
  });

  it("folds the form away and says so once the notice is sent", async () => {
    render(<UserNoticeForm user={lucia} />);
    open();
    write();
    fireEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Aviso enviado.");
    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
  });

  it("keeps the form and what was typed when the notice is refused", async () => {
    vi.mocked(sendNotice).mockResolvedValue({ status: "error", message: "No pudimos enviar el aviso." });
    render(<UserNoticeForm user={lucia} />);
    open();
    write();
    fireEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));

    expect(await screen.findByRole("status")).toHaveTextContent("No pudimos enviar el aviso.");
    expect(screen.getByLabelText("Título")).toHaveValue("Tu tienda necesita portada");
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Agrega una foto.");
  });

  it("can be put away without sending", () => {
    render(<UserNoticeForm user={lucia} />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByLabelText("Título")).not.toBeInTheDocument();
    expect(sendNotice).not.toHaveBeenCalled();
  });

  it("names an account that has no name by its address", () => {
    render(<UserNoticeForm user={{ ...lucia, displayName: null }} />);

    expect(
      screen.getByRole("button", { name: "Enviar aviso a lucia@tallervolcan.mx" }),
    ).toBeInTheDocument();
  });
});
