import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategorySuggestionForm } from "@/components/products/category-suggestion-form";
import type { ActionState } from "@/lib/action-state";
import type { CategoryTree } from "@/lib/categories";

const categories: CategoryTree[] = [
  {
    id: 1,
    parentId: null,
    slug: "electronica",
    name: "Electrónica",
    sortOrder: 10,
    isActive: true,
    children: [],
  },
  {
    id: 2,
    parentId: null,
    slug: "hogar-y-jardin",
    name: "Hogar y jardín",
    sortOrder: 20,
    isActive: false,
    children: [],
  },
];

const idleAction = async (): Promise<ActionState> => ({ status: "idle", message: "" });

afterEach(cleanup);

describe("CategorySuggestionForm", () => {
  it("keeps the suggestion fields collapsed until the seller needs them", () => {
    render(<CategorySuggestionForm action={idleAction} categories={categories} />);

    expect(screen.getByRole("button", { name: "No encuentro mi categoría" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Categoría sugerida")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No encuentro mi categoría" }));

    expect(screen.getByRole("button", { name: "No encuentro mi categoría" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Categoría sugerida")).toBeInTheDocument();
    expect(screen.getByLabelText("Detalles (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoría principal (opcional)")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Electrónica" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Hogar y jardín" })).not.toBeInTheDocument();
  });

  it("shows pending feedback and the submitted success status", async () => {
    let resolveAction: (state: ActionState) => void;
    const action = vi.fn(() => new Promise<ActionState>((resolve) => {
      resolveAction = resolve;
    }));
    render(<CategorySuggestionForm action={action} categories={categories} />);

    fireEvent.click(screen.getByRole("button", { name: "No encuentro mi categoría" }));
    fireEvent.change(screen.getByLabelText("Categoría sugerida"), { target: { value: "Instrumentos musicales" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugerencia" }));

    expect(await screen.findByRole("button", { name: "Enviando…" })).toBeDisabled();

    resolveAction!({
      status: "success",
      message: "Sugerencia enviada. La revisaremos antes de publicarla.",
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Sugerencia enviada. La revisaremos antes de publicarla.");
  });

  it("shows returned field errors without closing the seller's suggestion", async () => {
    const invalidAction = async (): Promise<ActionState> => ({
      status: "error",
      message: "Revisa los campos marcados.",
      errors: { suggested_name: ["El nombre debe tener entre 3 y 80 caracteres."] },
    });
    render(<CategorySuggestionForm action={invalidAction} categories={categories} />);

    fireEvent.click(screen.getByRole("button", { name: "No encuentro mi categoría" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar sugerencia" }));

    expect(await screen.findByText("El nombre debe tener entre 3 y 80 caracteres.")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoría sugerida")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Revisa los campos marcados.");
  });
});
