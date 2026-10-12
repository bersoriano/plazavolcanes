import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShopForm } from "@/components/shops/shop-form";
import type { ActionState } from "@/lib/action-state";
import { pickupPointFrom, pickupValidationError } from "@/lib/actions/shop-pickup-point";
import { shopSchema } from "@/lib/validation/shop";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("ShopForm", () => {
  it("shows México as a disabled country and requires a primary state", () => {
    render(<ShopForm action={action} />);

    expect(screen.getByLabelText("País")).toBeDisabled();
    expect(screen.getByLabelText("País")).toHaveValue("MX");
    expect(screen.getByLabelText("Estado principal")).toBeRequired();
    expect(screen.getByLabelText("Segundo estado (opcional)")).not.toBeRequired();
    expect(
      within(screen.getByLabelText("Estado principal")).getByRole("option", { name: "Jalisco" }),
    ).toBeInTheDocument();
  });

  it("submits both states under the same field name", () => {
    render(<ShopForm action={action} />);

    expect(screen.getByLabelText("Estado principal")).toHaveAttribute(
      "name",
      "administrative_area_codes",
    );
    expect(screen.getByLabelText("Segundo estado (opcional)")).toHaveAttribute(
      "name",
      "administrative_area_codes",
    );
  });

  it("drops the primary state from the second list so it cannot be picked twice", () => {
    render(<ShopForm action={action} />);

    fireEvent.change(screen.getByLabelText("Estado principal"), {
      target: { value: "MX-JAL" },
    });

    const secondary = screen.getByLabelText("Segundo estado (opcional)");
    expect(within(secondary).queryByRole("option", { name: "Jalisco" })).not.toBeInTheDocument();
    expect(within(secondary).getByRole("option", { name: "Colima" })).toBeInTheDocument();
  });

  it("clears the second state when the primary takes its place", () => {
    render(<ShopForm action={action} />);
    const primary = screen.getByLabelText("Estado principal");
    const secondary = screen.getByLabelText("Segundo estado (opcional)");

    fireEvent.change(primary, { target: { value: "MX-JAL" } });
    fireEvent.change(secondary, { target: { value: "MX-COL" } });
    expect(secondary).toHaveValue("MX-COL");

    fireEvent.change(primary, { target: { value: "MX-COL" } });

    expect(secondary).toHaveValue("");
  });

  it("preserves both selected states while editing", () => {
    render(
      <ShopForm
        action={action}
        shop={{
          name: "Casa Niebla",
          description: "Objetos hechos en un taller al pie del volcán.",
          imageUrl: null,
          countryCode: "MX",
          administrativeAreaCodes: ["MX-PUE", "MX-OAX"],
        }}
      />,
    );

    expect(screen.getByLabelText("Estado principal")).toHaveValue("MX-PUE");
    expect(screen.getByLabelText("Segundo estado (opcional)")).toHaveValue("MX-OAX");
  });

  it("hides the pickup fields until collection is offered", () => {
    render(<ShopForm action={action} />);

    expect(screen.getByLabelText("Ofrezco recolección en tienda")).not.toBeChecked();
    expect(screen.queryByLabelText("Calle y número de recolección")).not.toBeInTheDocument();
  });

  it("reveals the pickup fields when collection is offered", () => {
    render(<ShopForm action={action} />);

    fireEvent.click(screen.getByLabelText("Ofrezco recolección en tienda"));

    expect(screen.getByLabelText("Calle y número de recolección")).toBeRequired();
    expect(screen.getByLabelText("Ciudad de recolección")).toBeRequired();
    expect(screen.getByLabelText("Estado de recolección")).toBeRequired();
    expect(screen.getByLabelText("Código postal de recolección")).toBeRequired();
    expect(screen.getByLabelText("Referencias para llegar")).not.toBeRequired();
  });

  it("starts checked and filled for a shop that already offers collection", () => {
    render(
      <ShopForm
        action={action}
        pickupPoint={{
          addressLine1: "Av. Vallarta 1234",
          locality: "Zapopan",
          administrativeAreaCode: "MX-JAL",
          postalCode: "45010",
          notes: "Portón verde",
        }}
      />,
    );

    expect(screen.getByLabelText("Ofrezco recolección en tienda")).toBeChecked();
    expect(screen.getByLabelText("Calle y número de recolección")).toHaveValue("Av. Vallarta 1234");
    expect(screen.getByLabelText("Código postal de recolección")).toHaveValue("45010");
  });

  it("rehydrates the rejected pickup state and associates its server error", async () => {
    const rejected = async (): Promise<ActionState> => ({
      status: "error",
      message: "Revisa los datos de recolección.",
      errors: {
        pickup_administrative_area_code: ["Selecciona un estado de recolección."],
      },
    });

    render(
      <ShopForm
        action={rejected}
        pickupPoint={{
          addressLine1: "Av. Vallarta 1234",
          locality: "Zapopan",
          administrativeAreaCode: "MX-JAL",
          postalCode: "45010",
          notes: "Portón verde",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Estado de recolección"), {
      target: { value: "MX-OAX" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear tienda" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Revisa los datos de recolección.");
    });

    const select = screen.getByLabelText("Estado de recolección");
    expect(select).toHaveValue("MX-OAX");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute(
      "aria-describedby",
      "pickup-administrative-area-code-error",
    );
    expect(document.getElementById("pickup-administrative-area-code-error")).toHaveTextContent(
      "Selecciona un estado de recolección.",
    );
  });
  it("offers the delivery policy while the shop is being created", () => {
    render(<ShopForm action={action} />);

    const policy = screen.getByLabelText(/Política de entregas/);
    expect(policy).toHaveAttribute("name", "delivery_policy");
    expect(policy).not.toBeRequired();
  });

  it("leaves the delivery policy out of the edit form, where it saves on its own", () => {
    render(
      <ShopForm
        action={action}
        shop={{
          name: "Casa Niebla",
          description: "Objetos hechos en un taller al pie del volcán.",
          imageUrl: null,
          countryCode: "MX",
          administrativeAreaCodes: ["MX-PUE"],
        }}
      />,
    );

    expect(screen.queryByLabelText(/Política de entregas/)).not.toBeInTheDocument();
  });
});

describe.each(["create", "edit"] as const)("ShopForm %s submissions", (mode) => {
  function setup() {
    const submissions: FormData[] = [];
    const resetEvents: Event[] = [];
    const validate = async (_state: ActionState, data: FormData): Promise<ActionState> => {
      submissions.push(data);
      const shop = shopSchema.safeParse({
        name: data.get("name"),
        description: data.get("description"),
        country_code: data.get("country_code"),
        administrative_area_codes: data.getAll("administrative_area_codes").filter(Boolean),
      });
      if (!shop.success) {
        return { status: "error", message: "Revisa los campos marcados.", errors: shop.error.flatten().fieldErrors };
      }
      const pickup = pickupPointFrom(data);
      if (pickup.offered && !pickup.parsed?.success) return pickupValidationError(pickup.parsed);
      return { status: "success", message: "Guardado." };
    };
    const { container } = render(
      <ShopForm
        action={validate}
        shop={mode === "edit" ? {
          name: "Tienda anterior",
          description: "Descripción anterior de la tienda.",
          imageUrl: null,
          countryCode: "MX",
          administrativeAreaCodes: ["MX-PUE", "MX-OAX"],
        } : undefined}
      />,
    );
    // Observe React's actual native reset, without mocking reset() or the hook.
    container.querySelector("form")!.addEventListener("reset", (event) => resetEvents.push(event));
    for (const [label, value] of Object.entries({
      "Nombre de la tienda": "Casa Niebla",
      "Descripción": "Objetos de barro hechos a mano en México.",
      "Estado principal": "MX-CMX",
      "Segundo estado (opcional)": "MX-MEX",
    })) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByLabelText("Ofrezco recolección en tienda"));
    for (const [label, value] of Object.entries({
      "Calle y número de recolección": "Calle Niebla 12",
      "Ciudad de recolección": "Coyoacán",
      "Estado de recolección": "MX-CMX",
      "Código postal de recolección": "12",
      "Referencias para llegar": "Portón verde",
    })) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    return { submissions, resetEvents };
  }

  async function submit() {
    fireEvent.click(screen.getByRole("button", { name: mode === "edit" ? "Guardar cambios" : "Crear tienda" }));
  }

  function expectSelections() {
    expect(screen.getByLabelText("Estado principal")).toHaveValue("MX-CMX");
    expect(screen.getByLabelText("Segundo estado (opcional)")).toHaveValue("MX-MEX");
    expect(screen.getByLabelText("Ofrezco recolección en tienda")).toBeChecked();
    expect(screen.getByLabelText("Calle y número de recolección")).toBeVisible();
  }

  it("preserves choices and pickup details through a rejected action reset and correction", async () => {
    const { submissions, resetEvents } = setup();
    await submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Revisa los datos de recolección."));
    expect(resetEvents).toHaveLength(1);
    expectSelections();
    expect(screen.getByLabelText("Nombre de la tienda")).toHaveValue("Casa Niebla");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Objetos de barro hechos a mano en México.");
    expect(screen.getByLabelText("Calle y número de recolección")).toHaveValue("Calle Niebla 12");
    expect(screen.getByLabelText("Ciudad de recolección")).toHaveValue("Coyoacán");
    expect(screen.getByLabelText("Estado de recolección")).toHaveValue("MX-CMX");
    expect(screen.getByLabelText("Código postal de recolección")).toHaveValue("12");
    expect(screen.getByLabelText("Referencias para llegar")).toHaveValue("Portón verde");

    fireEvent.change(screen.getByLabelText("Código postal de recolección"), { target: { value: "04100" } });
    await submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Guardado."));
    expect(submissions).toHaveLength(2);
    expect(submissions[1].getAll("administrative_area_codes")).toEqual(["MX-CMX", "MX-MEX"]);
    expect(submissions[1].get("offers_pickup")).toBe("on");
    expect(submissions[1].get("pickup_postal_code")).toBe("04100");
    expectSelections();
  });

  it("preserves choices after ordinary shop validation errors", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Nombre de la tienda"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Corta" } });
    await submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Revisa los campos marcados."));
    expectSelections();
    expect(screen.getByLabelText("Nombre de la tienda")).toHaveValue("X");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Corta");
  });

  it("can disable pickup and still prevents duplicate states after an error", async () => {
    const { submissions } = setup();
    await submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Revisa los datos de recolección."));
    fireEvent.click(screen.getByLabelText("Ofrezco recolección en tienda"));
    expect(screen.getByLabelText("Ofrezco recolección en tienda")).not.toBeChecked();
    expect(screen.queryByLabelText("Calle y número de recolección")).not.toBeInTheDocument();
    const secondary = screen.getByLabelText("Segundo estado (opcional)");
    expect(within(secondary).queryByRole("option", { name: "Ciudad de México" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Estado principal"), { target: { value: "MX-MEX" } });
    expect(secondary).toHaveValue("");
    await submit();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Guardado."));
    expect(submissions[1].has("offers_pickup")).toBe(false);
    expect(submissions[1].has("pickup_address_line1")).toBe(false);
    expect(submissions[1].getAll("administrative_area_codes")).toEqual(["MX-MEX", ""]);
    expect(screen.queryByLabelText("Calle y número de recolección")).not.toBeInTheDocument();
  });
});
