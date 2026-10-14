import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContactMessages } from "@/components/admin/contact-messages";
import type { ContactMessage } from "@/lib/queries/contact";

const { markContactMessageAttended } = vi.hoisted(() => ({ markContactMessageAttended: vi.fn() }));

vi.mock("@/lib/actions/contact", () => ({ markContactMessageAttended }));

const visitor: ContactMessage = {
  id: "30000000-0000-4000-8000-000000000001",
  hasAccount: false,
  name: "Luis Pérez",
  email: "luis@correo.test",
  phone: "+525587654321",
  message: "No llegó mi pedido.\nEra el 1042.",
  createdAt: "2026-10-13T16:42:00Z",
  attendedAt: null,
};

const account: ContactMessage = {
  id: "30000000-0000-4000-8000-000000000002",
  hasAccount: true,
  name: null,
  email: "ana@correo.test",
  phone: null,
  message: "¿Cómo cambio mi correo?",
  createdAt: "2026-10-12T10:00:00Z",
  attendedAt: "2026-10-12T12:00:00Z",
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  markContactMessageAttended.mockResolvedValue({ status: "success", message: "Mensaje atendido." });
});

const card = (name: string) => screen.getByRole("article", { name });

describe("ContactMessages", () => {
  it("says when nothing has arrived", () => {
    render(<ContactMessages messages={[]} />);

    expect(screen.getByText("Aún no llega ningún mensaje.")).toBeInTheDocument();
  });

  it("shows who wrote, how to answer them, and what they said", () => {
    render(<ContactMessages messages={[visitor]} />);

    const luis = card("Luis Pérez");
    expect(within(luis).getByRole("link", { name: "luis@correo.test" })).toHaveAttribute(
      "href",
      "mailto:luis@correo.test",
    );
    expect(within(luis).getByRole("link", { name: "+525587654321" })).toHaveAttribute(
      "href",
      "tel:+525587654321",
    );
    expect(within(luis).getByText("Sin cuenta")).toBeInTheDocument();
    expect(within(luis).getByText(/No llegó mi pedido\.\s+Era el 1042\./)).toBeInTheDocument();
  });

  it("names an account without a name or a phone by its email alone", () => {
    render(<ContactMessages messages={[account]} />);

    const ana = card("Sin nombre");
    expect(within(ana).getByText("Con cuenta")).toBeInTheDocument();
    expect(within(ana).queryByRole("link", { name: /^\+52/ })).not.toBeInTheDocument();
  });

  it("shows what was attended without offering to attend it again", () => {
    render(<ContactMessages messages={[account]} />);

    const ana = card("Sin nombre");
    expect(within(ana).getByText(/^Atendido/)).toBeInTheDocument();
    expect(within(ana).queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks a waiting message as attended", async () => {
    render(<ContactMessages messages={[visitor]} />);

    fireEvent.click(
      within(card("Luis Pérez")).getByRole("button", { name: "Marcar como atendido: Luis Pérez" }),
    );

    await waitFor(() => expect(markContactMessageAttended).toHaveBeenCalledTimes(1));
    const formData = markContactMessageAttended.mock.calls[0]?.[1] as FormData;
    expect(formData.get("message_id")).toBe(visitor.id);
    expect(await screen.findByText("Mensaje atendido.")).toBeInTheDocument();
  });
});
