import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductTranslationForm } from "@/components/products/product-translation-form";
import type { ActionState } from "@/lib/action-state";

const idleAction = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("ProductTranslationForm", () => {
  it("renders the optional English editor collapsed by default", () => {
    render(<ProductTranslationForm action={idleAction} />);

    const summary = screen.getByText("Agregar versión en inglés");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Nombre en inglés")).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción en inglés")).toBeInTheDocument();
  });

  it("loads an existing seller-authored translation", () => {
    render(
      <ProductTranslationForm
        action={idleAction}
        translation={{
          name: "Clay coffee mug",
          description: "Handmade in a local workshop using regional clay.",
        }}
      />,
    );

    expect(screen.getByLabelText("Nombre en inglés")).toHaveValue("Clay coffee mug");
    expect(screen.getByLabelText("Descripción en inglés")).toHaveValue(
      "Handmade in a local workshop using regional clay.",
    );
  });

  it("shows the complete-pair requirement returned by the action", async () => {
    const invalidAction = async (): Promise<ActionState> => ({
      status: "error",
      message: "Revisa los campos marcados.",
      errors: {
        description: ["Escribe la descripción en inglés o deja ambos campos vacíos."],
      },
    });
    render(<ProductTranslationForm action={invalidAction} />);

    fireEvent.change(screen.getByLabelText("Nombre en inglés"), {
      target: { value: "Clay coffee mug" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar versión en inglés" }));

    expect(
      await screen.findByText("Escribe la descripción en inglés o deja ambos campos vacíos."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción en inglés")).toHaveAttribute("aria-invalid", "true");
  });

  it("submits a blank pair to remove an existing translation", async () => {
    const removeAction = vi.fn(async (_state: ActionState, formData: FormData) => {
      expect(formData.get("name")).toBe("");
      expect(formData.get("description")).toBe("");
      return { status: "success", message: "Versión en inglés eliminada." } satisfies ActionState;
    });
    render(
      <ProductTranslationForm
        action={removeAction}
        translation={{
          name: "Clay coffee mug",
          description: "Handmade in a local workshop using regional clay.",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Nombre en inglés"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Descripción en inglés"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar versión en inglés" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Versión en inglés eliminada.");
  });

  it("shows success feedback after saving a complete translation", async () => {
    const saveAction = async (): Promise<ActionState> => ({
      status: "success",
      message: "Versión en inglés guardada.",
    });
    render(<ProductTranslationForm action={saveAction} />);

    fireEvent.change(screen.getByLabelText("Nombre en inglés"), {
      target: { value: "Clay coffee mug" },
    });
    fireEvent.change(screen.getByLabelText("Descripción en inglés"), {
      target: { value: "Handmade in a local workshop using regional clay." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar versión en inglés" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Versión en inglés guardada.");
  });
});
