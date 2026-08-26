import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PasswordForm } from "@/components/auth/password-form";

vi.mock("@/lib/actions/auth", () => ({
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
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
