import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readPurchaseIntent = vi.fn();

vi.mock("@/lib/actions/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock("@/lib/purchase-intent.server", () => ({ readPurchaseIntent }));

const { default: SignInPage } = await import("@/app/(auth)/ingresar/page");

beforeEach(() => {
  vi.clearAllMocks();
  readPurchaseIntent.mockResolvedValue(null);
});

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

describe("Sign-in page purchase continuation", () => {
  it("explains why authentication is being asked for mid-purchase", async () => {
    readPurchaseIntent.mockResolvedValue({ productId: 12, quantity: 2, productPath: "/productos/taza" });

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ingresa o crea tu cuenta para continuar tu compra.",
    );
  });

  it("never calls a first purchase an expired session", async () => {
    readPurchaseIntent.mockResolvedValue({ productId: 12, quantity: 2, productPath: null });

    render(await SignInPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByText(/sesión terminó/)).not.toBeInTheDocument();
  });

  it("hands a validated continuation to the form", async () => {
    render(
      await SignInPage({ searchParams: Promise.resolve({ continuar: "/mensajes" }) }),
    );

    expect(document.querySelector('input[name="continuar"]')).toHaveValue("/mensajes");
  });

  it("drops a continuation that points at another site", async () => {
    render(
      await SignInPage({ searchParams: Promise.resolve({ continuar: "https://evil.example" }) }),
    );

    expect(document.querySelector('input[name="continuar"]')).toBeNull();
  });
});
