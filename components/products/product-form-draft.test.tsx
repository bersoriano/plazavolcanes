import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductForm } from "@/components/products/product-form";
import type { ActionState } from "@/lib/action-state";

vi.mock("@/lib/actions/media", () => ({ sweepMyOrphanedImages: async () => {} }));

/** jsdom ships no working localStorage here, so the test brings its own. */
function memoryStorage() {
  const entries = new Map<string, string>();

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
    removeItem: (key: string) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  } satisfies Storage;
}

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });
const created = { name: "Taza de barro", description: "Taza artesanal hecha a mano.", price_mxn: 200, status: "draft" as const, condition: "new" as const, used_condition: null, category_id: null, handling_days: 3, units_available: 1, imageUrl: null };

beforeEach(() => Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() }));
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("new product draft", () => {
  it("restores the seller's optional declarations in a new draft", () => {
    render(<ProductForm action={action} categories={[]} shopId={1} />);
    for (const [label, value] of [["Color", "blue"], ["Talla", "L"], ["Material", "cotton"], ["Impermeable", "false"], ["Otras características", "Capucha desmontable"]]) {
      expect(screen.getByLabelText(label)).toHaveValue("");
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    cleanup();
    render(<ProductForm action={action} categories={[]} shopId={1} />);
    expect(screen.getByLabelText("Color")).toHaveValue("blue");
    expect(screen.getByLabelText("Talla")).toHaveValue("L");
    expect(screen.getByLabelText("Otras características")).toHaveValue("Capucha desmontable");
    expect(screen.getByLabelText("Material")).toHaveValue("cotton");
    expect(screen.getByLabelText("Impermeable")).toHaveValue("false");
  });

  it("is forgotten once the product it held has been created", () => {
    render(<ProductForm action={action} categories={[]} shopId={1} />);
    fireEvent.input(screen.getByLabelText("Nombre del producto"), { target: { value: "Taza de barro" } });
    fireEvent.change(screen.getByLabelText("Nombre del producto"));
    cleanup();

    // createProduct redirects to the editor with ?creado=1 rather than
    // returning success to the form that held the draft.
    render(<ProductForm action={action} categories={[]} draftSaved product={created} productId={7} shopId={1} />);
    cleanup();

    render(<ProductForm action={action} categories={[]} shopId={1} />);
    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("");
    expect(screen.queryByText(/Recuperamos lo que habías escrito/)).not.toBeInTheDocument();
  });

  it("stays with the shop it was typed for", () => {
    render(<ProductForm action={action} categories={[]} shopId={1} />);
    fireEvent.input(screen.getByLabelText("Nombre del producto"), { target: { value: "Taza de barro" } });
    fireEvent.change(screen.getByLabelText("Nombre del producto"));
    cleanup();

    render(<ProductForm action={action} categories={[]} shopId={2} />);
    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("");
    cleanup();

    render(<ProductForm action={action} categories={[]} shopId={1} />);
    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Taza de barro");
  });
});

describe("product editor draft", () => {
  it("recovers an unsaved edit or clear unless the stored declaration has changed", () => {
    const product = { ...created, color: "blue" as const, waterproof: true };
    const editor = <ProductForm action={action} categories={[]} product={product} productId={7} shopId={1} />;
    render(editor);
    expect(screen.getByLabelText("Color")).toHaveValue("blue");
    expect(screen.getByLabelText("Impermeable")).toHaveValue("true");
    fireEvent.change(screen.getByLabelText("Color"), { target: { value: "red" } });
    fireEvent.change(screen.getByLabelText("Impermeable"), { target: { value: "" } });
    cleanup();
    render(editor);
    expect(screen.getByLabelText("Color")).toHaveValue("red");
    expect(screen.getByLabelText("Impermeable")).toHaveValue("");
    cleanup();
    render(<ProductForm action={action} categories={[]} product={{ ...product, color: "green" }} productId={7} shopId={1} />);
    expect(screen.getByLabelText("Color")).toHaveValue("green");
  });

  const undescribed = { ...created, description: null };

  it("belongs to one product even when another shares its name", () => {
    render(<ProductForm action={action} categories={[]} product={undescribed} productId={7} shopId={1} />);
    fireEvent.input(screen.getByLabelText("Descripción"), { target: { value: "Notas del producto siete." } });
    fireEvent.change(screen.getByLabelText("Descripción"));
    cleanup();

    render(<ProductForm action={action} categories={[]} product={undescribed} productId={8} shopId={1} />);
    expect(screen.getByLabelText("Descripción")).toHaveValue("");
    cleanup();

    render(<ProductForm action={action} categories={[]} product={{ ...undescribed, name: "Taza renombrada" }} productId={7} shopId={1} />);
    expect(screen.getByLabelText("Descripción")).toHaveValue("Notas del producto siete.");
  });
});
