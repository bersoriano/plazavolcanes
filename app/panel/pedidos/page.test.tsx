import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SellerOrderRow } from "@/lib/queries/orders.types";

const mocks = vi.hoisted(() => ({ getSellerOrderQueue: vi.fn() }));

vi.mock("@/lib/queries/orders.server", () => ({ getSellerOrderQueue: mocks.getSellerOrderQueue }));

const { default: SellerOrdersPage } = await import("@/app/panel/pedidos/page");

const NOW = new Date("2026-09-16T12:00:00.000Z");

function row(overrides: Partial<SellerOrderRow>): SellerOrderRow {
  return {
    id: 1,
    status: "requested",
    subtotal: 450,
    currency_code: "MXN",
    created_at: "2026-09-10T00:00:00.000Z",
    shop: { id: 1, name: "Casa Niebla", slug: "casa-niebla" },
    fulfillment_method: "shipping",
    payment_confirmation_required: true,
    payment_completed_at: null,
    ship_by_at: null,
    delivered_at: null,
    handling_time_zone: "America/Mexico_City",
    ...overrides,
  };
}

function ready(orders: SellerOrderRow[]) {
  return { status: "ready" as const, now: NOW, orders };
}

beforeEach(() => {
  mocks.getSellerOrderQueue.mockReset();
});

afterEach(cleanup);

describe("SellerOrdersPage", () => {
  it("sorts orders by whose move it is, with counts in the headings", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(
      ready([
        row({ id: 1, status: "completed", created_at: "2026-09-01T00:00:00.000Z" }),
        row({ id: 2, status: "shipped", payment_completed_at: "2026-09-03T00:00:00.000Z", created_at: "2026-09-02T00:00:00.000Z" }),
        row({ id: 3, created_at: "2026-09-10T00:00:00.000Z" }),
        row({
          id: 5,
          status: "accepted",
          payment_completed_at: "2026-09-12T00:00:00.000Z",
          ship_by_at: "2026-09-16T11:00:00.000Z",
          created_at: "2026-09-11T00:00:00.000Z",
        }),
      ]),
    );

    render(await SellerOrdersPage());

    const mine = screen.getByRole("region", { name: "Te toca actuar, 2 pedidos" });
    expect(within(mine).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/panel/pedidos/5", "/panel/pedidos/3"]);
    expect(within(mine).getByText("Envía el pedido")).toBeInTheDocument();
    expect(within(mine).getByText("Acepta o rechaza la solicitud")).toBeInTheDocument();
    expect(within(mine).getByText("Plazo vencido")).toBeInTheDocument();
    expect(within(mine).getByText(/^La fecha comprometida para enviar ya pasó: /)).toHaveAttribute("datetime", "2026-09-16T11:00:00.000Z");

    const theirs = screen.getByRole("region", { name: "Esperando al comprador, 1 pedido" });
    expect(within(theirs).getByText("El comprador debe confirmar que lo recibió")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Cerrados, 1 pedido" })).getByRole("link")).toHaveAttribute("href", "/panel/pedidos/1");
  });

  it("names a collected order's hand-over without shipping words", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(
      ready([row({ id: 7, status: "accepted", fulfillment_method: "pickup", payment_completed_at: "2026-09-12T00:00:00.000Z" })]),
    );

    render(await SellerOrdersPage());

    const mine = screen.getByRole("region", { name: "Te toca actuar, 1 pedido" });
    expect(within(mine).getByText("Entrega el pedido")).toBeInTheDocument();
    expect(within(mine).getByText("Recolección")).toBeInTheDocument();
  });

  it("keeps the seller's section and says plainly that nothing waits on them", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(ready([row({ id: 1, status: "completed" })]));

    render(await SellerOrdersPage());

    const mine = screen.getByRole("region", { name: "Te toca actuar, 0 pedidos" });
    expect(within(mine).getByText("Nada pendiente por ahora.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Esperando al comprador/ })).not.toBeInTheDocument();
  });

  it("shows the empty state to a seller who has not received an order", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(ready([]));

    render(await SellerOrdersPage());

    expect(screen.getByRole("heading", { name: "Aún no recibes pedidos" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Te toca actuar/ })).not.toBeInTheDocument();
  });

  it("says the orders could not be read instead of claiming there are none", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue({ status: "error" });

    render(await SellerOrdersPage());

    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tus pedidos");
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute("href", "/panel/pedidos");
    expect(screen.queryByText("Aún no recibes pedidos")).not.toBeInTheDocument();
  });
});
