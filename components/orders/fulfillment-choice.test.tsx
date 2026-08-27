import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FulfillmentChoice } from "@/components/orders/fulfillment-choice";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });
const point = { locality: "Zapopan", administrative_area_code: "MX-JAL" };

afterEach(cleanup);

describe("FulfillmentChoice", () => {
  it("starts with neither option chosen and the button disabled", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    expect(screen.getByLabelText("Recolección en tienda")).not.toBeChecked();
    expect(screen.getByLabelText("Envío a domicilio")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar solicitud" })).toBeDisabled();
    expect(screen.queryByLabelText("Calle y número")).not.toBeInTheDocument();
  });

  it("shows the address fields and enables the button when shipping is chosen", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Envío a domicilio"));

    expect(screen.getByLabelText("Nombre de quien recibe")).toBeRequired();
    expect(screen.getByLabelText("Calle y número")).toBeRequired();
    expect(screen.getByRole("button", { name: "Confirmar solicitud" })).toBeEnabled();
  });

  it("shows the shop's city and no address fields when pickup is chosen", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));

    expect(screen.getByText(/Zapopan/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Calle y número")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar solicitud" })).toBeEnabled();
  });

  it("sends pickup to the thread when the shop has no pickup point", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={null} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));

    expect(screen.getByText("Acuerden el punto de recolección en el chat")).toBeInTheDocument();
  });

  it("offers the alternate contact under both methods", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));
    expect(screen.getByLabelText("Nombre de la otra persona")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Envío a domicilio"));
    expect(screen.getByLabelText("Nombre de la otra persona")).toBeInTheDocument();
  });
});
