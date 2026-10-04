import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SellerOrderRow } from "@/lib/queries/orders.types";
import { sellerOrderStep } from "@/lib/seller-action-queue";
import type { SellerOrderCounts } from "@/lib/seller-orders-filter";

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
    decide_by_at: null,
    delivered_at: null,
    handling_time_zone: "America/Mexico_City",
    items: [{ product_name: "Taza Ceniza", quantity: 1, image_url: null }],
    ...overrides,
  };
}

const ONE_SHOP = [{ id: 1, name: "Casa Niebla" }];

function ready(
  orders: SellerOrderRow[],
  extra: { counts?: Partial<SellerOrderCounts>; shops?: { id: number; name: string }[]; hasMoreClosed?: boolean } = {},
) {
  const owners = orders.map((order) => sellerOrderStep(order).owner);
  const actuar = owners.filter((owner) => owner === "seller").length;
  const comprador = owners.filter((owner) => owner === "buyer").length;
  const cerrados = owners.filter((owner) => owner === "nobody").length;
  return {
    status: "ready" as const,
    now: NOW,
    orders,
    shops: extra.shops ?? ONE_SHOP,
    counts: { todos: orders.length, actuar, comprador, cerrados, ...extra.counts },
    hasMoreClosed: extra.hasMoreClosed ?? false,
  };
}

function params(values: Record<string, string>) {
  return { searchParams: Promise.resolve(values) };
}

beforeEach(() => {
  mocks.getSellerOrderQueue.mockReset();
});

afterEach(cleanup);

describe("SellerOrdersPage", () => {
  it("says on each row what was ordered", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(
      ready([
        row({
          id: 3,
          items: [
            { product_name: "Florero", quantity: 2, image_url: "https://cdn.test/florero.webp" },
            { product_name: "Jarra", quantity: 1, image_url: null },
          ],
        }),
      ]),
    );

    render(await SellerOrdersPage());

    const link = screen.getByRole("link", { name: /Florero ×2 y 1 producto más/ });
    expect(link).toHaveAttribute("href", "/panel/pedidos/3");
    expect(link.querySelector("img")).toHaveAttribute("src", "https://cdn.test/florero.webp");
    expect(within(link).getByText(/Pedido #3 · Casa Niebla/)).toBeInTheDocument();
  });

  it("passes the address's filter to the query", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(ready([]));

    render(await SellerOrdersPage(params({ estado: "cerrados", buscar: "flor", tienda: "1", cerrados: "40" })));

    expect(mocks.getSellerOrderQueue).toHaveBeenCalledWith({
      filter: { tab: "cerrados", search: "flor", shopId: 1, closedLimit: 40 },
    });
  });

  it("offers a tab per turn, with counts, marking the one on screen", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(ready([row({ id: 3 })], { counts: { todos: 9, actuar: 1, comprador: 2, cerrados: 6 } }));

    render(await SellerOrdersPage(params({ buscar: "flor" })));

    const tabs = screen.getByRole("navigation", { name: "Filtrar pedidos" });
    const links = within(tabs).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Todos9", "/panel/pedidos?buscar=flor"],
      ["Te toca actuar1", "/panel/pedidos?estado=actuar&buscar=flor"],
      ["Esperando al comprador2", "/panel/pedidos?estado=comprador&buscar=flor"],
      ["Cerrados6", "/panel/pedidos?estado=cerrados&buscar=flor"],
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
  });

  it("shows only the seller's turn on its tab", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(
      ready([row({ id: 3 }), row({ id: 2, status: "shipped", payment_completed_at: "2026-09-03T00:00:00.000Z" }), row({ id: 1, status: "completed" })]),
    );

    render(await SellerOrdersPage(params({ estado: "actuar" })));

    expect(screen.getByRole("region", { name: "Te toca actuar, 1 pedido" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Esperando al comprador/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Cerrados/ })).not.toBeInTheDocument();
  });

  it("offers a shop picker only to a seller with more than one shop", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(ready([row({ id: 3 })]));
    const { unmount } = render(await SellerOrdersPage());
    expect(screen.queryByRole("combobox", { name: "Tienda" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar pedido" })).toBeInTheDocument();
    unmount();

    mocks.getSellerOrderQueue.mockResolvedValue(ready([row({ id: 3 })], { shops: [...ONE_SHOP, { id: 4, name: "Taller Sur" }] }));
    render(await SellerOrdersPage(params({ tienda: "4" })));
    const picker = screen.getByRole("combobox", { name: "Tienda" });
    expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["Todas las tiendas", "Casa Niebla", "Taller Sur"]);
    expect(picker).toHaveValue("4");
  });

  it("loads more history on request, counting every closed order", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(
      ready([row({ id: 1, status: "completed" })], { counts: { cerrados: 57, todos: 57 }, hasMoreClosed: true }),
    );

    render(await SellerOrdersPage(params({ estado: "cerrados" })));

    expect(screen.getByRole("region", { name: "Cerrados, 57 pedidos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver más pedidos cerrados" })).toHaveAttribute("href", "/panel/pedidos?estado=cerrados&cerrados=40");
  });

  it("tells a filter that matched nothing apart from having no orders", async () => {
    mocks.getSellerOrderQueue.mockResolvedValue(ready([]));

    render(await SellerOrdersPage(params({ buscar: "nada" })));

    expect(screen.getByRole("heading", { name: "Ningún pedido coincide" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos los pedidos" })).toHaveAttribute("href", "/panel/pedidos");
    expect(screen.queryByText("Aún no recibes pedidos")).not.toBeInTheDocument();
  });

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
    expect(screen.getByText(/te avisaremos por correo/)).toBeInTheDocument();
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
