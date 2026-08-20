import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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

  it("lets buyers cancel requested or accepted unpaid orders", () => {
    const { rerender } = render(<OrderActions actions={{ cancelBuyer: action }} role="buyer" status="requested" />);
    expect(screen.getByRole("button", { name: "Cancelar pedido" })).toBeInTheDocument();
    rerender(<OrderActions actions={{ cancelBuyer: action }} paymentCompletedAt="2026-08-20T12:00:00Z" role="buyer" status="accepted" />);
    expect(screen.queryByRole("button", { name: "Cancelar pedido" })).not.toBeInTheDocument();
  });
});
