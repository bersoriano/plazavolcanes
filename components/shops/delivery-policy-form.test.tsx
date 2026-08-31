import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeliveryPolicyForm } from "@/components/shops/delivery-policy-form";
import type { ActionState } from "@/lib/action-state";

afterEach(cleanup);

function spyAction() {
  const submitted: FormData[] = [];
  const action = vi.fn(async (_state: ActionState, formData: FormData): Promise<ActionState> => {
    submitted.push(formData);
    return { status: "success", message: "Política de entregas actualizada." };
  });
  return { action, submitted };
}

describe("DeliveryPolicyForm", () => {
  it("starts with the policy the shop already published", () => {
    const { action } = spyAction();

    render(<DeliveryPolicyForm action={action} policy="Entrego los sábados." unlocksAt={null} />);

    expect(screen.getByLabelText(/Política de entregas/)).toHaveValue("Entrego los sábados.");
  });

  it("asks for confirmation instead of saving straight away", () => {
    const { action } = spyAction();
    render(<DeliveryPolicyForm action={action} policy="" unlocksAt={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Guardar política de entregas" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("saves the typed policy once the seller confirms", async () => {
    const { action, submitted } = spyAction();
    render(<DeliveryPolicyForm action={action} policy="" unlocksAt={null} />);

    fireEvent.change(screen.getByLabelText(/Política de entregas/), {
      target: { value: "Envío por paquetería en 3 días." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar política de entregas" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, guardar" }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(submitted[0].get("delivery_policy")).toBe("Envío por paquetería en 3 días.");
  });

  it("leaves the policy untouched when the seller backs out", () => {
    const { action } = spyAction();
    render(<DeliveryPolicyForm action={action} policy="" unlocksAt={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Guardar política de entregas" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("warns that the next change has to wait a month", () => {
    const { action } = spyAction();
    render(<DeliveryPolicyForm action={action} policy="" unlocksAt={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Guardar política de entregas" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/una vez al mes/);
  });

  it("closes the confirmation on Escape without saving", () => {
    const { action } = spyAction();
    render(<DeliveryPolicyForm action={action} policy="" unlocksAt={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Guardar política de entregas" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("holds the field shut until the month is up, and says when it opens", () => {
    const { action } = spyAction();

    render(
      <DeliveryPolicyForm
        action={action}
        policy="Entrego los sábados."
        unlocksAt="2026-09-19T12:00:00.000Z"
      />,
    );

    expect(screen.getByLabelText(/Política de entregas/)).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Guardar política de entregas" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/19 de septiembre de 2026/)).toBeInTheDocument();
  });
});
