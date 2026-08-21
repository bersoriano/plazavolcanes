import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductForm } from "@/components/products/product-form";
import type { ActionState } from "@/lib/action-state";
import type { CategoryTree } from "@/lib/categories";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });
const categories: CategoryTree[] = [
  {
    id: 1,
    parentId: null,
    slug: "electronica",
    name: "Electrónica",
    sortOrder: 10,
    isActive: true,
    children: [
      {
        id: 11,
        parentId: 1,
        slug: "celulares-y-accesorios",
        name: "Celulares y accesorios",
        sortOrder: 10,
        isActive: true,
      },
      {
        id: 12,
        parentId: 1,
        slug: "computadoras",
        name: "Computadoras",
        sortOrder: 20,
        isActive: false,
      },
    ],
  },
  {
    id: 2,
    parentId: null,
    slug: "hogar-y-jardin",
    name: "Hogar y jardín",
    sortOrder: 20,
    isActive: true,
    children: [
      {
        id: 21,
        parentId: 2,
        slug: "decoracion",
        name: "Decoración",
        sortOrder: 10,
        isActive: true,
      },
    ],
  },
];

afterEach(cleanup);

describe("ProductForm", () => {
  it("reveals used subcondition only when Usado is selected", () => {
    render(<ProductForm action={action} categories={categories} />);

    expect(screen.queryByLabelText("Estado del producto usado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Usado"));

    expect(screen.getByLabelText("Estado del producto usado")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Como nuevo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Para piezas" })).toBeInTheDocument();
  });

  it("keeps subcategory disabled until a main category is selected", () => {
    render(<ProductForm action={action} categories={categories} />);

    expect(screen.getByLabelText("Categoría")).toHaveValue("");
    expect(screen.getByLabelText("Subcategoría")).toBeDisabled();
  });

  it("shows only the selected main category leaves and clears a stale leaf", () => {
    render(<ProductForm action={action} categories={categories} />);

    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "1" } });

    const subcategory = screen.getByLabelText("Subcategoría");
    expect(subcategory).toBeEnabled();
    expect(screen.getByRole("option", { name: "Celulares y accesorios" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Decoración" })).not.toBeInTheDocument();

    fireEvent.change(subcategory, { target: { value: "11" } });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "2" } });

    expect(subcategory).toHaveValue("");
    expect(screen.getByRole("option", { name: "Decoración" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Celulares y accesorios" })).not.toBeInTheDocument();
  });

  it("warns when the saved subcategory is inactive", () => {
    render(
      <ProductForm
        action={action}
        categories={categories}
        product={{
          name: "Laptop reparable",
          description: "Equipo usado con detalles completos para la publicación.",
          price_mxn: 7500,
          status: "draft",
          condition: "used",
          used_condition: "fair",
          category_id: 12,
          imageUrl: null,
        }}
      />,
    );

    expect(screen.getByLabelText("Categoría")).toHaveValue("1");
    expect(screen.getByLabelText("Subcategoría")).toHaveValue("12");
    expect(screen.getByText("Esta subcategoría ya no está disponible. Selecciona otra antes de publicar.")).toBeInTheDocument();
  });

  it("shows a published category field error returned by the action", async () => {
    const invalidCategoryAction = async (): Promise<ActionState> => ({
      status: "error",
      message: "Revisa los campos marcados.",
      errors: { category_id: ["Selecciona una subcategoría válida antes de publicar."] },
    });
    render(<ProductForm action={invalidCategoryAction} categories={categories} />);

    fireEvent.click(screen.getByRole("button", { name: "Publicar producto" }));

    expect(await screen.findByText("Selecciona una subcategoría válida antes de publicar.")).toBeInTheDocument();
    expect(screen.getByLabelText("Subcategoría")).toHaveAttribute("aria-invalid", "true");
  });

  it("submits the fixed catalog currency and source locale", () => {
    render(<ProductForm action={action} categories={categories} />);

    const form = screen.getByRole("button", { name: "Publicar producto" }).closest("form");

    expect(form?.elements.namedItem("currency_code")).toHaveValue("MXN");
    expect(form?.elements.namedItem("content_locale")).toHaveValue("es-MX");
  });
});

describe("ProductForm units available", () => {
  it("offers a single unit by default", () => {
    render(<ProductForm action={action} categories={[]} />);

    const units = screen.getByLabelText("Unidades disponibles");

    expect(units).toHaveValue(1);
    expect(units).toHaveAttribute("min", "1");
    expect(units).toHaveAttribute("max", "10");
    expect(units).toBeRequired();
  });

  it("keeps the stated units while editing", () => {
    render(
      <ProductForm
        action={action}
        categories={[]}
        product={{
          name: "Taza volcánica",
          description: "Taza hecha a mano con barro de alta temperatura.",
          price_mxn: 349,
          status: "draft",
          condition: "new",
          used_condition: null,
          category_id: null,
          units_available: 4,
          imageUrl: null,
        }}
      />,
    );

    expect(screen.getByLabelText("Unidades disponibles")).toHaveValue(4);
  });
});

describe("ProductForm gallery", () => {
  it("accepts several images at once and states the limits", () => {
    render(<ProductForm action={action} categories={[]} />);

    const input = screen.getByLabelText(/Imágenes del producto/);

    expect(input).toHaveAttribute("multiple");
    expect(input).toHaveAttribute("name", "images");
    expect(screen.getByText(/hasta 5 im[áa]genes/i)).toBeInTheDocument();
    expect(screen.getByText(/2 MB/)).toBeInTheDocument();
  });

  it("shows the images the product already holds", () => {
    render(
      <ProductForm
        action={action}
        categories={[]}
        images={[
          { id: 1, url: "https://example.test/a.jpg", position: 0 },
          { id: 2, url: "https://example.test/b.jpg", position: 1 },
        ]}
        product={{
          name: "Taza volcánica",
          description: "Taza hecha a mano con barro de alta temperatura.",
          price_mxn: 349,
          status: "draft",
          condition: "new",
          used_condition: null,
          category_id: null,
          units_available: 1,
          imageUrl: null,
        }}
      />,
    );

    expect(screen.getAllByRole("img", { name: /Imagen \d/ })).toHaveLength(2);
    expect(screen.getByText("Portada")).toBeInTheDocument();
    expect(screen.getByText("Quedan 3 espacios de 5.")).toBeInTheDocument();
  });
});
