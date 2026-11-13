import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductQuestionComposer } from "@/components/messages/product-question-composer";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

describe("product question draft", () => {
  it("lets a visitor write first and restores draft after sign-in", async () => {
    const action = vi.fn(async () => ({ status: "success" as const, message: "Pregunta enviada.", conversationId: 42 }));
    const props = { action, productId: 12, productPath: "/productos/iphone", sellerName: "Cool Cats Tech" };
    const first = render(<ProductQuestionComposer {...props} resume={false} signedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Preguntar por este producto" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Tu pregunta" }), { target: { value: "¿Cuánto dura la batería?" } });
    expect(screen.getByRole("link", { name: "Ingresa para enviar tu pregunta" })).toHaveAttribute("href", "/ingresar?continuar=%2Fproductos%2Fiphone%3Fpregunta%3D1");
    expect(action).not.toHaveBeenCalled();
    first.unmount();

    render(<ProductQuestionComposer {...props} resume signedIn />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveValue("¿Cuánto dura la batería?"));
    fireEvent.submit(screen.getByRole("button", { name: "Enviar pregunta" }).closest("form")!);
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/mensajes/42"));
    expect(localStorage.getItem("pregunta:producto:12")).toBeNull();
  });

  it("keeps text and send key when delivery fails", async () => {
    const action = vi.fn(async () => ({ status: "error" as const, message: "No pudimos enviar tu pregunta." }));
    render(<ProductQuestionComposer action={action} productId={13} productPath="/productos/iphone" resume sellerName="Cool Cats Tech" signedIn />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tu pregunta" }), { target: { value: "¿Está liberado?" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar pregunta" })).not.toBeDisabled());
    fireEvent.submit(screen.getByRole("button", { name: "Enviar pregunta" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No pudimos enviar tu pregunta."));
    expect(screen.getByRole("textbox", { name: "Tu pregunta" })).toHaveValue("¿Está liberado?");
    expect(JSON.parse(localStorage.getItem("pregunta:producto:13") ?? "{}").body).toBe("¿Está liberado?");
  });
});
