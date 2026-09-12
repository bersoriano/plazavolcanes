import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PurchasesPage from "@/app/compras/page";
import { getBuyerOrders } from "@/lib/queries/orders.server";
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
