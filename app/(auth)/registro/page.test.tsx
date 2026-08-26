import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readPurchaseIntent = vi.fn();

vi.mock("@/lib/actions/auth", () => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/purchase-intent.server", () => ({ readPurchaseIntent }));

const { default: SignUpPage } = await import("@/app/(auth)/registro/page");

beforeEach(() => {
  vi.clearAllMocks();
  readPurchaseIntent.mockResolvedValue(null);
});

afterEach(cleanup);

describe("Registration page", () => {
  it("explains that the account is what the purchase is waiting on", async () => {
    readPurchaseIntent.mockResolvedValue({ productId: 12, quantity: 1, productPath: null });

    render(await SignUpPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ingresa o crea tu cuenta para continuar tu compra.",
    );
  });

  it("says nothing extra to somebody simply opening an account", async () => {
    render(await SignUpPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a validated continuation for after registration", async () => {
    render(await SignUpPage({ searchParams: Promise.resolve({ continuar: "/mensajes" }) }));

    expect(document.querySelector('input[name="continuar"]')).toHaveValue("/mensajes");
  });
});
