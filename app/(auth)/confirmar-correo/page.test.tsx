import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const resendConfirmation = vi.fn();
vi.mock("@/lib/actions/auth", () => ({ requestPasswordReset: vi.fn(), updatePassword: vi.fn(), resendConfirmation }));
const { default: ConfirmationPage } = await import("./page");
afterEach(cleanup);

it("offers resend and sign-in while preserving seller continuation", async () => {
  render(await ConfirmationPage({ searchParams: Promise.resolve({ intent: "vender", continuar: "/mensajes" }) }));
  expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reenviar confirmación" })).toBeInTheDocument();
  expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
  expect(document.querySelector('input[name="continuar"]')).toHaveValue("/mensajes");
  expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveAttribute("href", "/ingresar?continuar=%2Fmensajes&intent=vender");
});

it("never forwards unsafe continuation into resend or sign-in", async () => {
  render(await ConfirmationPage({ searchParams: Promise.resolve({ continuar: "//evil.example" }) }));
  expect(document.querySelector('input[name="continuar"]')).toBeNull();
  expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveAttribute("href", "/ingresar");
});
