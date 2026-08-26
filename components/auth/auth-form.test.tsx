import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";

vi.mock("@/lib/actions/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

afterEach(cleanup);

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
