import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

afterEach(cleanup);

describe("shared control contracts", () => {
  it("lets layout overrides replace conflicting defaults", () => {
    render(<Button className="rounded-xl px-2 text-lg">Guardar</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("rounded-xl", "px-2", "text-lg");
    expect(button).not.toHaveClass("rounded-full", "px-5", "text-sm");
  });

  it("defaults ordinary actions to button and preserves explicit submit names and values", () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(<form onSubmit={submit}><Button>Vista previa</Button><Button name="intent" type="submit" value="publish">Publicar</Button></form>);
    fireEvent.click(screen.getByRole("button", { name: "Vista previa" }));
    expect(submit).not.toHaveBeenCalled();
    const publish = screen.getByRole("button", { name: "Publicar" });
    fireEvent.click(publish);
    expect(submit).toHaveBeenCalledOnce();
    expect(publish).toHaveAttribute("name", "intent");
    expect(publish).toHaveAttribute("value", "publish");
  });

  it("keeps action links navigable as real links", () => {
    render(<ButtonLink href="/panel/tiendas/nueva" variant="secondary">Crear tienda</ButtonLink>);
    expect(screen.getByRole("link", { name: "Crear tienda" })).toHaveAttribute("href", "/panel/tiendas/nueva");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("preserves input refs, controlled changes, native constraints, and form values", () => {
    const ref = createRef<HTMLInputElement>();
    const change = vi.fn();
    render(<form aria-label="Inventario"><Input aria-label="Unidades" min={1} name="units" onChange={change} ref={ref} required type="number" value={2} /></form>);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "3" } });
    expect(change).toHaveBeenCalledOnce();
    expect(ref.current).toBe(screen.getByRole("spinbutton"));
    expect(ref.current).toBeRequired();
    expect(ref.current).toHaveAttribute("min", "1");
    expect(new FormData(screen.getByRole("form") as HTMLFormElement).get("units")).toBe("2");
  });

  it("preserves select options, textarea values, and disabled controls", () => {
    render(<><Select aria-label="Estado" defaultValue="draft"><option value="draft">Borrador</option><option value="published">Publicado</option></Select><Textarea aria-label="Descripción" defaultValue="Hecho en México" disabled /></>);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "published" } });
    expect(select).toHaveValue("published");
    expect(screen.getByRole("textbox")).toHaveValue("Hecho en México");
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("links unnamed fields to unique labels and combines supplied descriptions with validation", () => {
    render(<><p id="policy">Solo para este pedido</p><Field aria-describedby="policy" error="Revisa el dato" hint="10 dígitos" label="Teléfono" /><Field label="Referencia" /></>);
    const phone = screen.getByRole("textbox", { name: "Teléfono" });
    const reference = screen.getByRole("textbox", { name: "Referencia" });
    expect(phone.id).toBeTruthy();
    expect(phone.id).not.toBe(reference.id);
    expect(phone).toHaveAccessibleDescription("Solo para este pedido 10 dígitos Revisa el dato");
    expect(phone).toHaveAttribute("aria-invalid", "true");
  });
});
