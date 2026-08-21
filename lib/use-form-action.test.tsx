import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

afterEach(cleanup);

function Probe({ action }: { action: (state: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useFormAction(action);

  return (
    <form action={formAction}>
      <label htmlFor="name">Nombre</label>
      <input defaultValue={state.values?.name ?? ""} id="name" name="name" />
      <label htmlFor="password">Contraseña</label>
      <input defaultValue={state.values?.password ?? ""} id="password" name="password" type="password" />
      <button type="submit">Guardar</button>
      {state.message ? <p role="status">{state.message}</p> : null}
    </form>
  );
}

const rejecting = async (): Promise<ActionState> => ({
  status: "error",
  message: "Revisa los campos marcados.",
  errors: { name: ["Muy corto."] },
});

const accepting = async (): Promise<ActionState> => ({
  status: "success",
  message: "Guardado.",
});

describe("useFormAction", () => {
  it("restores typed values after a rejected submit", async () => {
    render(<Probe action={rejecting} />);
    const name = screen.getByLabelText("Nombre") as HTMLInputElement;

    fireEvent.change(name, { target: { value: "Casa Niebla" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    expect(name.value).toBe("Casa Niebla");
  });

  it("never restores a password", async () => {
    render(<Probe action={rejecting} />);
    const password = screen.getByLabelText("Contraseña") as HTMLInputElement;

    fireEvent.change(password, { target: { value: "secreto12" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    expect(password.value).toBe("");
  });

  it("lets a successful submit clear the form", async () => {
    render(<Probe action={accepting} />);
    const name = screen.getByLabelText("Nombre") as HTMLInputElement;

    fireEvent.change(name, { target: { value: "Casa Niebla" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

    expect(name.value).toBe("");
  });
});
