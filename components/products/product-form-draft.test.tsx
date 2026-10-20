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
