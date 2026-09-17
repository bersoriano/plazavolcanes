import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OrderActions } from "@/components/orders/order-actions";

const action = async () => ({ status: "idle" as const, message: "" });

afterEach(cleanup);

describe("OrderActions payment evidence", () => {
  it("requires seller payment confirmation before shipment on v2 orders", () => {
    render(<OrderActions actions={{ payment: action, ship: action, cancelSeller: action }} paymentConfirmationRequired role="seller" status="accepted" />);
    expect(screen.getByRole("button", { name: "Confirmar pago" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como enviado" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Razón de cancelación" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Falta de pago del comprador" })).toBeInTheDocument();
  });

  it("shows shipment and hides cancellation after payment confirmation", () => {
    render(<OrderActions actions={{ payment: action, ship: action, cancelSeller: action }} paymentCompletedAt="2026-08-20T12:00:00Z" paymentConfirmationRequired role="seller" status="accepted" />);
    expect(screen.getByRole("button", { name: "Marcar como enviado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar pago" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument();
  });

  it("names the hand-over of a collected order without shipping words", () => {
    render(<OrderActions actions={{ payment: action, ship: action, cancelSeller: action }} fulfillmentMethod="pickup" paymentCompletedAt="2026-08-20T12:00:00Z" paymentConfirmationRequired role="seller" status="accepted" />);
    expect(screen.getByRole("button", { name: "Marcar como entregado" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como enviado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Seguimiento o referencia" })).not.toBeInTheDocument();
  });

  it("keeps the tracking field on a shipped order", () => {
    render(<OrderActions actions={{ ship: action }} fulfillmentMethod="shipping" paymentCompletedAt="2026-08-20T12:00:00Z" paymentConfirmationRequired role="seller" status="accepted" />);
    expect(screen.getByRole("button", { name: "Marcar como enviado" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Seguimiento o referencia" })).toBeInTheDocument();
  });

  it("holds the button while a request is on its way, so a double tap sends it once", async () => {
    const slow = vi.fn(() => new Promise<never>(() => {}));
    render(<OrderActions actions={{ accept: slow, reject: action }} role="seller" status="requested" />);

    fireEvent.click(screen.getByRole("button", { name: "Aceptar pedido" }));
    const busy = await screen.findByRole("button", { name: "Actualizando…" });
    fireEvent.click(busy);

    expect(busy).toBeDisabled();
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("lets buyers cancel requested or accepted unpaid orders", () => {
    const { rerender } = render(<OrderActions actions={{ cancelBuyer: action }} role="buyer" status="requested" />);
    expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeInTheDocument();
    rerender(<OrderActions actions={{ cancelBuyer: action }} paymentCompletedAt="2026-08-20T12:00:00Z" role="buyer" status="accepted" />);
    expect(screen.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument();
  });
});
