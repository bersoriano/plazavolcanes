import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductForm } from "@/components/products/product-form";
import type { ActionState } from "@/lib/action-state";

const action = async (): Promise<ActionState> => ({ status: "idle", message: "" });

describe("ProductForm", () => {
  it("reveals used subcondition only when Usado is selected", () => {
    render(<ProductForm action={action} />);

    expect(screen.queryByLabelText("Estado del producto usado")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Usado"));

    expect(screen.getByLabelText("Estado del producto usado")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Como nuevo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Para piezas" })).toBeInTheDocument();
  });
});
