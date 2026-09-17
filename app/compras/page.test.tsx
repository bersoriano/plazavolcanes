import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PurchasesPage from "@/app/compras/page";
import { getBuyerOrders, type BuyerOrderRow } from "@/lib/queries/orders.server";
import { requireSignedIn } from "@/lib/require-signed-in.server";

vi.mock("@/lib/queries/orders.server", () => ({ getBuyerOrders: vi.fn() }));
vi.mock("@/lib/require-signed-in.server", () => ({ requireSignedIn: vi.fn() }));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSignedIn).mockResolvedValue("buyer-1");
  vi.mocked(getBuyerOrders).mockResolvedValue([]);
});

describe("reaching the purchases page", () => {
  it("asks a signed-out visitor to sign in and come back", async () => {
    // Without this the page reads their empty result as "you have no orders",
    // which tells someone whose session expired that their history is gone.
    vi.mocked(requireSignedIn).mockRejectedValue(new Error("NEXT_REDIRECT:/ingresar?continuar=/compras"));

    await expect(PurchasesPage()).rejects.toThrow("NEXT_REDIRECT:/ingresar?continuar=/compras");
  });

  it("names the route it should return to", async () => {
    await PurchasesPage();

    expect(requireSignedIn).toHaveBeenCalledWith("/compras");
  });

  it("still says the shelf is empty for a signed-in buyer with no orders", async () => {
    render(await PurchasesPage());

    expect(screen.getByText("Todavía no tienes pedidos")).toBeInTheDocument();
  });
});

describe("the purchases list", () => {
  function purchase(overrides: Partial<BuyerOrderRow>): BuyerOrderRow {
    return {
      id: 1,
      status: "requested",
      subtotal: 250,
      currency_code: "MXN",
      created_at: "2026-09-10T12:00:00Z",
      shop: { id: 2, name: "Casa Niebla", slug: "casa-niebla" },
      fulfillment_method: "shipping",
      payment_confirmation_required: true,
      payment_completed_at: null,
      ship_by_at: null,
      delivered_at: null,
      handling_time_zone: "America/Mexico_City",
      ...overrides,
    };
  }

  it("says what each purchase is waiting for, in words", async () => {
    vi.mocked(getBuyerOrders).mockResolvedValue([
      purchase({ id: 1 }),
      purchase({ id: 2, status: "shipped", fulfillment_method: "pickup", payment_completed_at: "2026-09-11T12:00:00Z" }),
    ]);

    render(await PurchasesPage());

    const requested = screen.getByRole("link", { name: /Pedido #1/ });
    expect(within(requested).getByText("Esperando a la tienda")).toBeInTheDocument();
    const collected = screen.getByRole("link", { name: /Pedido #2/ });
    expect(within(collected).getByText("Entregado por la tienda")).toBeInTheDocument();
    expect(within(collected).queryByText("Enviado")).not.toBeInTheDocument();
  });
});
