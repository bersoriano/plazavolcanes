import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FulfillmentSummary } from "@/components/orders/fulfillment-summary";

afterEach(cleanup);

const address = {
  recipient: "Ana Ruiz",
  address_line1: "Calle 1",
  address_line2: null,
  locality: "Zapopan",
  administrative_area: "Jalisco",
  postal_code: "45010",
  country_code: "MX",
  delivery_instructions: null,
  redacted_at: null,
};

describe("FulfillmentSummary", () => {
  it("shows the delivery address for a shipped order", () => {
    render(
      <FulfillmentSummary
        altContact={null}
        address={address}
        fulfillmentMethod="shipping"
        pickupPoint={null}
      />,
    );

    expect(screen.getByText("Envío a domicilio")).toBeInTheDocument();
    expect(screen.getByText("Calle 1")).toBeInTheDocument();
  });

  it("withholds the street for a pending pickup order", () => {
    render(
      <FulfillmentSummary
        altContact={null}
        address={null}
        fulfillmentMethod="pickup"
        pickupPoint={{ locality: "Zapopan", administrative_area_code: "MX-JAL" }}
      />,
    );

    expect(screen.getByText("Recolección en tienda")).toBeInTheDocument();
    expect(screen.getByText(/Zapopan/)).toBeInTheDocument();
    expect(
      screen.getByText("Verás la dirección completa cuando el vendedor acepte tu pedido."),
    ).toBeInTheDocument();
  });

  it("shows the street once it has been revealed", () => {
    render(
      <FulfillmentSummary
        altContact={null}
        address={null}
        fulfillmentMethod="pickup"
        pickupPoint={{
          locality: "Zapopan",
          administrative_area_code: "MX-JAL",
          address_line1: "Av. Vallarta 1234",
          postal_code: "45010",
          notes: "Portón verde",
        }}
      />,
    );

    expect(screen.getByText("Av. Vallarta 1234")).toBeInTheDocument();
    expect(screen.getByText("Portón verde")).toBeInTheDocument();
  });

  it("names the person collecting when there is one", () => {
    render(
      <FulfillmentSummary
        altContact={{ name: "Luis Ruiz", phone: "+523312345678", note: "mi hermano" }}
        address={null}
        fulfillmentMethod="pickup"
        pickupPoint={{ locality: "Zapopan", administrative_area_code: "MX-JAL" }}
      />,
    );

    expect(screen.getByText("Luis Ruiz")).toBeInTheDocument();
    expect(screen.getByText("mi hermano")).toBeInTheDocument();
  });
});
