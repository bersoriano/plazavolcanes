import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";
import { CheckoutForm } from "@/components/orders/checkout-form";
import { ProductForm } from "@/components/products/product-form";
import { ShopForm } from "@/components/shops/shop-form";
import type { ActionState } from "@/lib/action-state";

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
    realtime: { setAuth: vi.fn() },
    auth: { getSession: async () => ({ data: { session: null } }) },
  }),
}));
vi.mock("@/lib/actions/messages", () => ({ markConversationRead: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

vi.mock("@/lib/actions/auth", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(async (): Promise<ActionState> => ({
    status: "error",
    message: "Revisa los campos marcados.",
    errors: { password: ["Usa al menos 8 caracteres."] },
  })),
}));

const rejecting = async (): Promise<ActionState> => ({
  status: "error",
  message: "Revisa los campos marcados.",
  errors: { name: ["Muy corto."] },
});

afterEach(cleanup);

async function submitAndWait(buttonName: RegExp | string) {
  fireEvent.click(screen.getByRole("button", { name: buttonName }));
  await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
}

describe("a rejected submit never discards what was typed", () => {
  it("keeps the whole shipping address on the checkout form", async () => {
    render(<CheckoutForm action={rejecting} idempotencyKey="key-1" />);

    const typed: Record<string, string> = {
      "Nombre de quien recibe": "Ana Ruiz",
      "Calle y número": "Calle Volcán 12",
      "Interior o referencia": "Depto 3",
      "Ciudad o localidad": "Guadalajara",
      Estado: "Jalisco",
      "Código postal": "44100",
      "Instrucciones de entrega": "Tocar el timbre",
      "Nota para vendedor": "Sin prisa",
    };

    for (const [label, value] of Object.entries(typed)) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }

    await submitAndWait(/Confirmar|Enviar|Solicitar/);

    for (const [label, value] of Object.entries(typed)) {
      expect(screen.getByLabelText(label)).toHaveValue(value);
    }
  });

  it("keeps the shop name and description", async () => {
    render(<ShopForm action={rejecting} />);

    fireEvent.change(screen.getByLabelText("Nombre de la tienda"), {
      target: { value: "Casa Niebla" },
    });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Objetos de barro hechos a mano." },
    });

    await submitAndWait(/Crear tienda/);

    expect(screen.getByLabelText("Nombre de la tienda")).toHaveValue("Casa Niebla");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Objetos de barro hechos a mano.");
  });

  it("keeps every product field, including price and units", async () => {
    render(<ProductForm action={rejecting} categories={[]} />);

    fireEvent.change(screen.getByLabelText("Nombre del producto"), {
      target: { value: "Taza de barro negro" },
    });
    fireEvent.change(screen.getByLabelText("Descripción"), {
      target: { value: "Pieza torneada a mano en horno de leña." },
    });
    fireEvent.change(screen.getByLabelText("Precio en MXN"), { target: { value: "480" } });
    fireEvent.change(screen.getByLabelText("Unidades disponibles"), { target: { value: "4" } });

    await submitAndWait("Guardar borrador");

    expect(screen.getByLabelText("Nombre del producto")).toHaveValue("Taza de barro negro");
    expect(screen.getByLabelText("Descripción")).toHaveValue(
      "Pieza torneada a mano en horno de leña.",
    );
    expect(screen.getByLabelText("Precio en MXN")).toHaveValue(480);
    expect(screen.getByLabelText("Unidades disponibles")).toHaveValue(4);
  });

  it("keeps the email and phone on registration but never the password", async () => {
    render(<AuthForm mode="signup" />);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "persona@volcanes.mx" },
    });
    fireEvent.change(screen.getByLabelText("Teléfono móvil"), {
      target: { value: "3312345678" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "corto" } });

    await submitAndWait(/Crear cuenta/);

    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("persona@volcanes.mx");
    expect(screen.getByLabelText("Teléfono móvil")).toHaveValue("3312345678");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });
});

describe("choices and non-text fields", () => {
  it("keeps a chosen radio and select on the review form", async () => {
    const { ReviewForm } = await import("@/components/orders/review-form");
    render(<ReviewForm action={rejecting} />);

    fireEvent.change(screen.getByLabelText(/Calificación/), { target: { value: "4" } });
    fireEvent.click(screen.getByLabelText("No"));
    fireEvent.change(screen.getByLabelText(/Comentario/), { target: { value: "Llegó tarde." } });

    await submitAndWait(/Guardar reseña/);

    expect(screen.getByLabelText(/Calificación/)).toHaveValue("4");
    expect(screen.getByLabelText("No")).toBeChecked();
    expect(screen.getByLabelText("Sí")).not.toBeChecked();
    expect(screen.getByLabelText(/Comentario/)).toHaveValue("Llegó tarde.");
  });

  it("keeps the message a buyer was writing", async () => {
    const { MessageThread } = await import("@/components/messages/message-thread");
    render(
      <MessageThread
        action={rejecting}
        conversationId={7}
        currentUserId="buyer-uuid"
        messages={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Mensaje"), {
      target: { value: "¿Ya lo enviaste?" },
    });

    await submitAndWait(/Enviar mensaje/);

    expect(screen.getByLabelText("Mensaje")).toHaveValue("¿Ya lo enviaste?");
  });
});
