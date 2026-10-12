import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resendConfirmation } from "@/lib/actions/auth";
import { PasswordForm } from "@/components/auth/password-form";

vi.mock("@/lib/actions/auth", () => ({
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  resendConfirmation: vi.fn(),
}));

afterEach(cleanup);

describe("PasswordForm", () => {
  it("asks only for an address when requesting a link", () => {
    render(<PasswordForm mode="request" />);

    expect(screen.getByLabelText("Correo electrónico")).toBeRequired();
    expect(screen.queryByLabelText("Contraseña nueva")).not.toBeInTheDocument();
  });

  it("asks for the new password twice when setting one", () => {
    render(<PasswordForm mode="update" />);

    const password = screen.getByLabelText("Contraseña nueva");
    const confirmation = screen.getByLabelText("Repite la contraseña");

    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(confirmation).toHaveAttribute("name", "password_confirm");
    expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
  });

  it("offers the way back to sign-in from the request form", () => {
    render(<PasswordForm mode="request" />);

    expect(screen.getByRole("link", { name: "Volver a ingresar" })).toHaveAttribute(
      "href",
      "/ingresar",
    );
  });
});


it("allows immediate corrected submission after an email validation error", async () => {
  vi.mocked(resendConfirmation).mockResolvedValueOnce({ status: "error", message: "Revisa los campos marcados.", errors: { email: ["Escribe un correo válido."] } }).mockResolvedValueOnce({ status: "success", message: "Si ese correo tiene cuenta pendiente, recibirás un enlace." });
  render(<PasswordForm mode="confirmation" intent="vender" continuar="/panel/cuenta" />);
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "bad" } });
  fireEvent.click(screen.getByRole("button", { name: "Reenviar confirmación" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Revisa los campos marcados."));
  expect(screen.getByRole("button", { name: "Reenviar confirmación" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@correo.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Reenviar confirmación" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Si ese correo"));
  expect(resendConfirmation).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: /Espera .* s/ })).toBeDisabled();
});
