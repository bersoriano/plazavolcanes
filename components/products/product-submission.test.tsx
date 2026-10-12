import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "@/components/products/product-form";
import type { ActionState } from "@/lib/action-state";

vi.mock("@/lib/actions/media", () => ({ sweepMyOrphanedImages: async () => {}, requestProductImageUploads: async () => ({ tickets: [{}], error: null }) }));
vi.mock("@/lib/media/signature", () => ({ inspectImage: async () => ({ supported: true, type: "image/png" }) }));
vi.mock("@/lib/media/upload-client", () => ({ uploadWithTickets: async () => ({ keys: ["products/owner/1/photo.png"], error: null }) }));
beforeEach(() => { vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:photo"; } }); });

const categories = [{ id: 1, parentId: null, slug: "arte", name: "Arte", sortOrder: 1, isActive: true,
  children: [{ id: 11, parentId: 1, slug: "papeleria", name: "Papelería", sortOrder: 1, isActive: true }, { id: 12, parentId: 1, slug: "manualidades", name: "Manualidades", sortOrder: 2, isActive: true }] }];
const product = { name: "Taza de barro", description: "Taza artesanal hecha a mano.", price_mxn: 200, status: "draft" as const, condition: "new" as const, used_condition: null, category_id: 11, handling_days: 3, units_available: 2, imageUrl: null };
afterEach(() => { cleanup(); window.localStorage?.clear(); vi.unstubAllGlobals(); });

describe("product submission recovery", () => {
  it.each(["validation", "server", "draft save", "publication save"])("keeps current classification and other fields after %s", async (outcome) => {
    const submissions: FormData[] = [];
    const action = async (_state: ActionState, data: FormData): Promise<ActionState> => {
      submissions.push(data);
      return outcome.endsWith("save") ? { status: "success", message: "Guardado" } : { status: "error", message: "No guardado", ...(outcome === "validation" ? { errors: { name: ["Nombre inválido"] } } : {}) };
    };
    render(<ProductForm shopId={1} categories={categories} action={action} product={product} images={[{ id: 1, url: "/cover.jpg", position: 0 }]} />);
    fireEvent.change(screen.getByLabelText("Subcategoría"), { target: { value: "12" } });
    fireEvent.input(screen.getByLabelText("Nombre del producto"), { target: { value: "Nombre nuevo" } });
    fireEvent.input(screen.getByLabelText("Descripción"), { target: { value: "Descripción nueva que debe conservarse." } });
    fireEvent.click(screen.getByRole("button", { name: outcome === "publication save" ? "Publicar producto" : "Guardar borrador" }));
    await screen.findByText(outcome.endsWith("save") ? "Guardado" : "No guardado");
    await waitFor(() => expect(screen.getByLabelText("Subcategoría")).toHaveValue("12"));
    expect(screen.getByLabelText("Categoría", { exact: true })).toHaveValue("1");
    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Nombre nuevo");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Descripción nueva que debe conservarse.");
    expect(screen.getByRole("img", { name: "Imagen 1" })).toBeInTheDocument();
    expect(submissions[0].get("category_id")).toBe("12");
    expect(new FormData(screen.getByLabelText("Subcategoría").closest("form")!).get("category_id")).toBe("12");
    expect(screen.queryByRole("link", { name: /Selecciona una subcategoría/ })).not.toBeInTheDocument();
  });

  it("clears checklist classification immediately when parent changes", () => {
    render(<ProductForm shopId={1} categories={categories} action={async () => ({ status: "idle", message: "" })} product={product} />);
    fireEvent.change(screen.getByLabelText("Categoría", { exact: true }), { target: { value: "" } });
    expect(screen.getByRole("link", { name: /subcategoría/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Subcategoría")).toHaveValue("");
  });
});

describe("initial draft feedback", () => {
  it.each([true, false])("confirms creation and offers approval-aware next step (approved=%s)", (approved) => {
    window.history.replaceState({}, "", "/panel/productos/1/editar?creado=1&limite=alcanzado#nombre");
    render(<ProductForm shopId={1} categories={categories} action={async () => ({ status: "idle", message: "" })} product={product} draftSaved shopPublication={{ is_publishing_approved: approved, publishing_reviewed_at: null }} />);
    expect(screen.getByText("Borrador guardado").closest('[role="status"]')).toBeInTheDocument();
    expect(screen.getByText(/Siguiente paso:/)).toHaveTextContent(approved ? /Publicar producto/ : /Dejar pendiente de aprobación/);
    expect(new URL(window.location.href).searchParams.has("creado")).toBe(false);
    expect(window.location.search).toBe("?limite=alcanzado");
    expect(window.location.hash).toBe("#nombre");
    cleanup();
    render(<ProductForm shopId={1} categories={categories} action={async () => ({ status: "idle", message: "" })} product={product} />);
    expect(screen.queryByText("Borrador guardado")).not.toBeInTheDocument();
  });
});

it("retains uploaded photos through errors, then submits them only once after saving", async () => {
  const submissions: string[][] = [];
  const action = async (_state: ActionState, data: FormData): Promise<ActionState> => {
    submissions.push(data.getAll("image_keys") as string[]);
    return submissions.length === 1 ? { status: "error", message: "Error del servidor" } : { status: "success", message: "Guardado" };
  };
  const { container } = render(<ProductForm shopId={1} categories={categories} action={action} product={product} />);
  fireEvent.change(screen.getByLabelText(/Imágenes del producto/), { target: { files: [new File(["image"], "photo.png", { type: "image/png" })] } });
  await waitFor(() => expect(container.querySelector('input[name="image_keys"]')).toHaveValue("products/owner/1/photo.png"));
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await screen.findByText("Error del servidor");
  expect(screen.getByRole("img", { name: "Vista previa" })).toHaveAttribute("src", "blob:photo");
  expect(container.querySelector('input[name="image_keys"]')).toHaveValue("products/owner/1/photo.png");
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await screen.findByText("Guardado");
  expect(container.querySelector('input[name="image_keys"]')).toBeNull();
  expect(submissions).toEqual([["products/owner/1/photo.png"], ["products/owner/1/photo.png"]]);
});

it("keeps the editor open when saving throws a server error", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<ProductForm shopId={1} categories={categories} product={product} action={async () => { throw new Error("Server unavailable"); }} />);
    fireEvent.change(screen.getByLabelText("Subcategoría"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await screen.findByText("No pudimos guardar el producto. Intenta de nuevo.");
    expect(screen.getByLabelText("Subcategoría")).toHaveValue("12");
  } finally {
    log.mockRestore();
  }
});

it("does not offer pending approval for a draft disabled by administration", () => {
  render(<ProductForm shopId={1} categories={categories} product={product} action={async () => ({ status: "idle", message: "" })} shopPublication={{ is_publishing_approved: false, publishing_reviewed_at: null }} isAdminEnabled={false} />);
  expect(screen.getByRole("button", { name: "Guardar para publicar" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Dejar pendiente de aprobación" })).not.toBeInTheDocument();
});

it("keeps selected used condition through a failed save and successful retry", async () => {
  let attempts = 0;
  render(<ProductForm shopId={1} categories={categories} product={{ ...product, condition: "used", used_condition: "good" }} action={async () => ++attempts === 1 ? { status: "error", message: "Error del servidor" } : { status: "success", message: "Guardado" }} />);
  fireEvent.change(screen.getByLabelText("Estado del producto usado"), { target: { value: "fair" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await screen.findByText("Error del servidor");
  expect(screen.getByLabelText("Estado del producto usado")).toHaveValue("fair");
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await screen.findByText("Guardado");
  expect(screen.getByLabelText("Estado del producto usado")).toHaveValue("fair");
});
