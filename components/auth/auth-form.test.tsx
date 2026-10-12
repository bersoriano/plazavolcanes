import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signUp, resendConfirmation } from "@/lib/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

vi.mock("@/lib/actions/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
}));

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("AuthForm", () => {
  it("requires a mobile phone when registering", () => {
    render(<AuthForm mode="signup" />);

    const phone = screen.getByLabelText("Teléfono móvil");

    expect(phone).toBeRequired();
    expect(phone).toHaveAttribute("name", "phone");
    expect(phone).toHaveAttribute("inputMode", "numeric");
    expect(screen.getByText("+52")).toBeInTheDocument();
  });

  it("does not ask signing in users for a phone", () => {
    render(<AuthForm mode="signin" />);

    expect(screen.queryByLabelText("Teléfono móvil")).not.toBeInTheDocument();
  });

  it("carries a continuation through to the server action", () => {
    render(<AuthForm continuar="/mensajes" mode="signin" />);

    const field = document.querySelector('input[name="continuar"]');

    expect(field).toHaveAttribute("type", "hidden");
    expect(field).toHaveValue("/mensajes");
  });

  it("carries seller intent through registration and sign-in", () => {
    render(<AuthForm intent="vender" mode="signup" />);

    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
    expect(screen.getByRole("link", { name: "Ingresa" })).toHaveAttribute("href", "/ingresar?intent=vender");
  });

  it("keeps the continuation when sending someone to register instead", () => {
    render(<AuthForm continuar="/carrito/4" mode="signin" />);

    expect(screen.getByRole("link", { name: "Regístrate" })).toHaveAttribute(
      "href",
      "/registro?continuar=%2Fcarrito%2F4",
    );
  });

  it("links to plain registration when there is nothing to continue", () => {
    render(<AuthForm mode="signin" />);

    expect(screen.getByRole("link", { name: "Regístrate" })).toHaveAttribute("href", "/registro");
    expect(document.querySelector('input[name="continuar"]')).toBeNull();
  });

  it("points people who forgot their password at the recovery form", () => {
    render(<AuthForm mode="signin" />);

    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute(
      "href",
      "/recuperar",
    );
  });

  it("does not offer recovery while registering", () => {
    render(<AuthForm mode="signup" />);

    expect(
      screen.queryByRole("link", { name: "¿Olvidaste tu contraseña?" }),
    ).not.toBeInTheDocument();
  });
});


describe("completed signup", () => {
  async function complete(continuar = "/panel/cuenta") {
    vi.mocked(signUp).mockResolvedValue({ status: "success", message: "Revisa tu correo para confirmar tu cuenta.", confirmationEmail: "ana@correo.com" });
    render(<AuthForm mode="signup" intent="vender" continuar={continuar} />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@correo.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Confirma tu correo" })).toBeInTheDocument());
  }

  it("replaces signup fields with destination, steps, and contextual recovery", async () => {
    await complete();
    expect(screen.getByText("ana@correo.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Confirma tu correo" })).toHaveFocus();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear cuenta" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Corregir correo o empezar de nuevo" })).toHaveAttribute("href", "/registro?paso=formulario&continuar=%2Fpanel%2Fcuenta&intent=vender");
    expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveAttribute("href", "/ingresar?continuar=%2Fpanel%2Fcuenta&intent=vender");
    expect(document.querySelector('input[name="password"]')).toBeNull();
  });

  it("restarts signup even when client navigation preserves the page component", async () => {
    await complete();
    const restart = screen.getByRole("link", { name: "Corregir correo o empezar de nuevo" });
    restart.addEventListener("click", (event) => event.preventDefault(), { once: true });
    fireEvent.click(restart);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Abre tu cuenta" })).toBeInTheDocument());
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
    expect(document.querySelector('input[name="continuar"]')).toHaveValue("/panel/cuenta");
  });

  it("drops unsafe continuation from every recovery action", async () => {
    await complete("//evil.example");
    expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveAttribute("href", "/ingresar?intent=vender");
    expect(screen.getByRole("link", { name: "Corregir correo o empezar de nuevo" })).toHaveAttribute("href", "/registro?paso=formulario&intent=vender");
    expect(document.querySelector('input[name="continuar"]')).toBeNull();
  });

  it("blocks repeated resends while processing, announces loading, then enforces uniform cooldown", async () => {
    let finish!: (value: { status: "success"; message: string }) => void;
    vi.mocked(resendConfirmation).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await complete();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar confirmación" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled());
    expect(screen.getByText("Enviando solicitud de confirmación…")).toHaveAttribute("role", "status");
    expect(resendConfirmation).toHaveBeenCalledOnce();
    const sent = vi.mocked(resendConfirmation).mock.calls[0][1];
    expect(sent.get("email")).toBe("ana@correo.com");
    expect(sent.get("intent")).toBe("vender");
    expect(sent.get("continuar")).toBe("/panel/cuenta");
    expect(sent.get("password")).toBeNull();
    finish({ status: "success", message: "Si ese correo tiene una cuenta pendiente, recibirás un enlace nuevo." });
    await waitFor(() => expect(screen.getByText(/Si ese correo/)).toHaveAttribute("role", "status"));
    expect(screen.getByRole("button", { name: /Espera .* s/ })).toBeDisabled();
  });

  it("announces unexpected resend failure without provider details", async () => {
    vi.mocked(resendConfirmation).mockRejectedValue(new Error("private provider detail"));
    await complete();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar confirmación" }));
    await waitFor(() => expect(screen.getByText(/No pudimos procesar la solicitud/)).toHaveAttribute("role", "alert"));
    expect(screen.queryByText(/private provider/)).not.toBeInTheDocument();
  });
});


it("allows another resend after the uniform cooldown expires", async () => {
  vi.mocked(signUp).mockResolvedValue({ status: "success", message: "Revisa tu correo.", confirmationEmail: "ana@correo.com" });
  vi.mocked(resendConfirmation).mockResolvedValue({ status: "success", message: "Si ese correo tiene cuenta pendiente, recibirás un enlace." });
  render(<AuthForm mode="signup" />);
  fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Confirma tu correo" })).toBeInTheDocument());
  vi.useFakeTimers();
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reenviar confirmación" })); });
  expect(screen.getByRole("button", { name: "Espera 60 s" })).toBeDisabled();
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect(screen.getByRole("button", { name: "Reenviar confirmación" })).toBeEnabled();
});
