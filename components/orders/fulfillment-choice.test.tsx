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
  });

  it("shows the address fields and enables the button when shipping is chosen", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Envío a domicilio"));

    expect(screen.getByLabelText("Nombre de quien recibe")).toBeRequired();
    expect(screen.getByLabelText("Calle y número")).toBeRequired();
    expect(screen.getByRole("button", { name: "Confirmar solicitud" })).toBeEnabled();
  });

  it("describes each fulfillment option with its privacy explanation", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    const pickup = screen.getByRole("radio", { name: "Recolección en tienda" });
    const shipping = screen.getByRole("radio", { name: "Envío a domicilio" });

    expect(document.getElementById(pickup.getAttribute("aria-describedby") ?? "")).toHaveTextContent(
      "Vas por él y no compartes tu dirección.",
    );
    expect(document.getElementById(shipping.getAttribute("aria-describedby") ?? "")).toHaveTextContent(
      "Solo esta tienda y tú verán tu dirección.",
    );
  });

  it("keeps a typed address when switching fulfillment methods", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Envío a domicilio"));
    const address = screen.getByLabelText("Calle y número");
    fireEvent.change(address, { target: { value: "Av. Hidalgo 123" } });

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));
    fireEvent.click(screen.getByLabelText("Envío a domicilio"));

    expect(screen.getByLabelText("Calle y número")).toHaveValue("Av. Hidalgo 123");
  });

  it("disables the address fieldset while pickup is selected", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Envío a domicilio"));
    fireEvent.click(screen.getByLabelText("Recolección en tienda"));

    const addressFieldset = screen.getByText("Calle y número").closest("fieldset");

    expect(addressFieldset).toBeDisabled();
    expect(addressFieldset).toHaveAttribute("hidden");
  });

  it("shows the shop's city and hides address fields when pickup is chosen", () => {
    render(<FulfillmentChoice action={action} idempotencyKey="k" pickupPoint={point} threadHref="#hilo" />);

    fireEvent.click(screen.getByLabelText("Recolección en tienda"));

    expect(screen.getByText(/Zapopan/)).toBeInTheDocument();
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
