import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "@/components/legal/contact-form";

const { submitContactMessage } = vi.hoisted(() => ({ submitContactMessage: vi.fn() }));

vi.mock("@/lib/actions/contact", () => ({ submitContactMessage }));

const received = "Recibimos tu mensaje. Te responderemos por correo o teléfono.";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  submitContactMessage.mockResolvedValue({ status: "success", message: received });
});

const message = () => screen.getByLabelText("Mensaje", { exact: true });
const send = () => fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

describe("ContactForm", () => {
  it("asks a visitor how to answer them", () => {
    render(<ContactForm signedIn={false} />);

    expect(screen.getByLabelText("Nombre")).toBeRequired();
    expect(screen.getByLabelText("Correo electrónico")).toBeRequired();
    expect(screen.getByLabelText("Teléfono móvil")).toBeRequired();
    expect(message()).toBeRequired();
  });

  it("asks a signed-in person for the message alone", () => {
    render(<ContactForm signedIn />);

    expect(message()).toBeRequired();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Teléfono móvil")).not.toBeInTheDocument();
    expect(screen.getByText(/datos de contacto de tu cuenta/)).toBeInTheDocument();
  });

  it("says what the details are for and links the privacy notice", () => {
    render(<ContactForm signedIn={false} />);

    expect(screen.getByText(/solo para responder tu mensaje/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute("href", "/privacidad");
  });

  it("keeps the bot trap out of reach of people", () => {
    render(<ContactForm signedIn={false} />);

    const trap = screen.getByLabelText("Sitio web");
    expect(trap).toHaveAttribute("tabindex", "-1");
    expect(trap).toHaveAttribute("autocomplete", "off");
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("confirms a message was received, and offers to write another", async () => {
    render(<ContactForm signedIn />);
    fireEvent.change(message(), { target: { value: "El vendedor no responde." } });
    send();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(received));
    expect(submitContactMessage).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Mensaje", { exact: true })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Escribir otro mensaje" }));

    expect(message()).toHaveValue("");
  });

  it("marks each field that was refused and keeps what was typed", async () => {
    submitContactMessage.mockResolvedValue({
      status: "error",
      message: "Revisa los campos marcados.",
      errors: { phone: ["Escribe tu teléfono móvil a 10 dígitos."] },
    });
    render(<ContactForm signedIn={false} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Luis Pérez" } });
    fireEvent.change(screen.getByLabelText("Teléfono móvil"), { target: { value: "123" } });
    fireEvent.change(message(), { target: { value: "No llegó mi pedido." } });
    send();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Revisa los campos marcados."));
    const phone = screen.getByLabelText("Teléfono móvil");
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(phone).toHaveAccessibleDescription(/Escribe tu teléfono móvil a 10 dígitos\./);
    expect(screen.getByLabelText("Nombre")).toHaveValue("Luis Pérez");
    expect(message()).toHaveValue("No llegó mi pedido.");
  });

  it("ties a refused message to its box", async () => {
    submitContactMessage.mockResolvedValue({
      status: "error",
      message: "Revisa los campos marcados.",
      errors: { message: ["Escribe un mensaje de entre 10 y 2000 caracteres."] },
    });
    render(<ContactForm signedIn />);
    fireEvent.change(message(), { target: { value: "Hola" } });
    send();

    await waitFor(() => expect(message()).toHaveAttribute("aria-invalid", "true"));
    expect(message()).toHaveAccessibleDescription("Escribe un mensaje de entre 10 y 2000 caracteres.");
  });
});
