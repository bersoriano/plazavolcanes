import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readPurchaseIntent = vi.fn();

vi.mock("@/lib/actions/auth", () => ({ signIn: vi.fn(), signUp: vi.fn() }));
vi.mock("@/lib/purchase-intent.server", () => ({ readPurchaseIntent }));

const { default: SignUpPage } = await import("@/app/(auth)/registro/page");
const { default: SignInPage } = await import("@/app/(auth)/ingresar/page");

type Params = { continuar?: string; paso?: string; vender?: string; intent?: string };

async function renderPage(params: Params = {}) {
  render(await SignUpPage({ searchParams: Promise.resolve(params) }));
}

function link(name: string) {
  return screen.getByRole("link", { name });
}

async function followLink(name: string) {
  const url = new URL(link(name).getAttribute("href")!, "https://plazavolcanes.com");
  cleanup();
  const searchParams = Promise.resolve(Object.fromEntries(url.searchParams));
  render(await (url.pathname === "/ingresar" ? SignInPage : SignUpPage)({ searchParams }));
}

beforeEach(() => {
  vi.clearAllMocks();
  readPurchaseIntent.mockResolvedValue(null);
});

afterEach(cleanup);

describe("Registration onboarding", () => {
  it.each([{ vender: "1" }, { intent: "vender" }])("opens the seller form directly for %j", async (params) => {
    await renderPage(params);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Abre tu cuenta");
    expect(screen.queryByRole("heading", { name: "Así se vende" })).not.toBeInTheDocument();
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
  });

  it("starts by asking what brings somebody to the plaza", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¿Qué te trae a la plaza?");
    expect(link("Quiero comprar")).toHaveAttribute(
      "href",
      "/registro?paso=comprar",
    );
    expect(link("Quiero vender")).toHaveAttribute(
      "href",
      "/registro?paso=vender&intent=vender",
    );
    expect(link("Quiero vender")).toHaveAccessibleDescription("Abre tu tienda y recibe solicitudes de pedido.");
    expect(link("Saltar e ir al registro")).toHaveAttribute("href", "/registro?paso=formulario");
    expect(screen.queryByRole("textbox", { name: "Correo electrónico" })).not.toBeInTheDocument();
  });

  it("falls back to the start for a step it does not know", async () => {
    await renderPage({ paso: "otro" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¿Qué te trae a la plaza?");
  });

  it("walks a buyer through ordering, with a way back and a way to the other side", async () => {
    await renderPage({ paso: "comprar" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Así se compra");
    const steps = screen.getAllByRole("listitem");
    expect(steps.map((step) => step.querySelector("h2")?.textContent)).toEqual([
      "Explora y compara",
      "Solicita tu pedido",
      "Confirma y reseña",
    ]);
    expect(link("Volver")).toHaveAttribute("href", "/registro?paso=inicio");
    expect(link("Ver cómo se vende")).toHaveAttribute("href", "/registro?paso=vender&intent=vender");
    expect(link("Crear mi cuenta")).toHaveAttribute("href", "/registro?paso=formulario");
    expect(link("Saltar e ir al registro")).toHaveAttribute("href", "/registro?paso=formulario");
  });

  it("walks a seller through opening a shop, with a way back and a way to the other side", async () => {
    await renderPage({ paso: "vender" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Así se vende");
    const steps = screen.getAllByRole("listitem");
    expect(steps.map((step) => step.querySelector("h2")?.textContent)).toEqual([
      "Crea tu tienda",
      "Publica tus productos",
      "Recibe solicitudes",
    ]);
    expect(screen.getByText(/no procesa ni retiene fondos/)).toBeInTheDocument();
    expect(link("Volver")).toHaveAttribute("href", "/registro?paso=inicio&intent=vender");
    expect(link("Ver cómo se compra")).toHaveAttribute("href", "/registro?paso=comprar&intent=vender");
    expect(link("Crear mi cuenta")).toHaveAttribute("href", "/registro?paso=formulario&intent=vender");
  });

  it("shows the form when asked for it, with a way back to the guide", async () => {
    await renderPage({ paso: "formulario" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Abre tu cuenta");
    expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
    expect(link("Ver cómo funciona")).toHaveAttribute("href", "/registro?paso=inicio");
  });
});

describe("Registration in the middle of a purchase", () => {
  it("goes straight to the form and explains what the account is for", async () => {
    readPurchaseIntent.mockResolvedValue({ productId: 12, quantity: 1, productPath: null });

    await renderPage();

    expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ingresa o crea tu cuenta para continuar tu compra.",
    );
  });

  it("still lets that buyer open the guide on purpose", async () => {
    readPurchaseIntent.mockResolvedValue({ productId: 12, quantity: 1, productPath: null });

    await renderPage({ paso: "comprar" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Así se compra");
  });

  it("says nothing extra to somebody simply opening an account", async () => {
    await renderPage({ paso: "formulario" });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("goes straight to the form with a continuation, and keeps it through the guide", async () => {
    await renderPage({ continuar: "/mensajes" });

    expect(document.querySelector('input[name="continuar"]')).toHaveValue("/mensajes");
    expect(link("Ver cómo funciona")).toHaveAttribute(
      "href",
      "/registro?paso=inicio&continuar=%2Fmensajes",
    );

    cleanup();
    await renderPage({ continuar: "/mensajes", paso: "vender" });

    expect(link("Volver")).toHaveAttribute("href", "/registro?paso=inicio&continuar=%2Fmensajes&intent=vender");
    expect(link("Crear mi cuenta")).toHaveAttribute(
      "href",
      "/registro?paso=formulario&continuar=%2Fmensajes&intent=vender",
    );
  });

  it("drops a continuation that is not an internal path", async () => {
    await renderPage({ continuar: "https://example.com", paso: "vender" });

    expect(link("Volver")).toHaveAttribute("href", "/registro?paso=inicio&intent=vender");
  });
});

describe("Seller intent across onboarding navigation", () => {
  it.each(["Crear mi cuenta", "Saltar e ir al registro"])("keeps seller intent from the entry through the guide via %s", async (accountLink) => {
    await renderPage({ vender: "1" });
    await followLink("Ver cómo funciona");
    await followLink("Quiero vender");
    await followLink(accountLink);
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
  });

  it("starts seller intent when an ordinary visitor chooses the seller guide", async () => {
    await renderPage();
    await followLink("Quiero vender");
    await followLink("Crear mi cuenta");
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
  });

  it("keeps seller intent through guide back, skip and sign-in links", async () => {
    await renderPage({ paso: "vender", continuar: "/mensajes" });
    await followLink("Volver");
    expect(link("Ingresa")).toHaveAttribute("href", "/ingresar?continuar=%2Fmensajes&intent=vender");
    await followLink("Saltar e ir al registro");
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
    expect(document.querySelector('input[name="continuar"]')).toHaveValue("/mensajes");
  });

  it("keeps seller intent while viewing the buyer guide", async () => {
    await renderPage({ paso: "vender" });
    await followLink("Ver cómo se compra");
    await followLink("Crear mi cuenta");
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
  });

  it.each([{ intent: "vender" }, { vender: "1" }])("keeps seller intent through sign-in → signup → sign-in for %j", async (params) => {
    render(await SignInPage({ searchParams: Promise.resolve({ ...params, continuar: "/mensajes" }) }));
    await followLink("Regístrate");
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
    await followLink("Ingresa");
    expect(document.querySelector('input[name="intent"]')).toHaveValue("vender");
    expect(document.querySelector('input[name="continuar"]')).toHaveValue("/mensajes");
  });

  it("leaves buyer guide → signup → sign-in without seller intent", async () => {
    await renderPage();
    await followLink("Quiero comprar");
    await followLink("Crear mi cuenta");
    expect(document.querySelector('input[name="intent"]')).toBeNull();
    await followLink("Ingresa");
    expect(document.querySelector('input[name="intent"]')).toBeNull();
  });
});
