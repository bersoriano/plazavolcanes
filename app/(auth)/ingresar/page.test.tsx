import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/(auth)/ingresar/page";

vi.mock("@/lib/actions/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

afterEach(cleanup);

describe("Sign-in page notices", () => {
  it("explains a spent recovery link instead of showing a bare form", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({ error: "recuperacion" }) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ese enlace ya no sirve. Pide uno nuevo para crear tu contraseña.",
    );
  });

  it("explains a failed confirmation link", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({ error: "confirmacion" }) }));

    expect(screen.getByRole("status")).toHaveTextContent("No pudimos confirmar");
  });

  it("says nothing when someone simply opens the page", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
