import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readPurchaseIntent = vi.fn();

vi.mock("@/lib/actions/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  resendConfirmation: vi.fn(),
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

    expect(screen.getByRole("status")).toHaveTextContent(/expirado|usado/);
    expect(screen.getByRole("link", { name: /reenviar correo de confirmación/i })).toHaveAttribute("href", "/confirmar-correo");
  });

  it("offers password sign-in after session exchange failure without claiming verified email", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({ error: "sesion_confirmacion", intent: "vender", continuar: "/mensajes" }) }));
    expect(screen.getByRole("status")).toHaveTextContent(/iniciar sesión automáticamente/);
    expect(screen.getByRole("status")).not.toHaveTextContent(/tu cuenta está confirmada|tu correo está confirmado/i);
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeInTheDocument();
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
    expect(document.querySelector('input[name="continuar"]')).toHaveValue("/mensajes");
    expect(screen.getByRole("link", { name: /reenviar correo de confirmación/i })).toHaveAttribute("href", "/confirmar-correo?continuar=%2Fmensajes&intent=vender");
  });

  it("keeps confirmation recovery guidance visible alongside purchase guidance", async () => {
    readPurchaseIntent.mockResolvedValue({ productId: 12, quantity: 1, productPath: null });
    render(await SignInPage({ searchParams: Promise.resolve({ error: "sesion_confirmacion", intent: "vender" }) }));
    expect(screen.getByText(/iniciar sesión automáticamente/)).toBeInTheDocument();
    expect(screen.getByText("Ingresa o crea tu cuenta para continuar tu compra.")).toBeInTheDocument();
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
