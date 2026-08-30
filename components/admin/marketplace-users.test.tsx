import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketplaceUsers } from "@/components/admin/marketplace-users";

const { setShopPublishingApproval } = vi.hoisted(() => ({
  setShopPublishingApproval: vi.fn(),
}));

vi.mock("@/lib/actions/admin-publication", () => ({ setShopPublishingApproval }));

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setShopPublishingApproval).mockResolvedValue({ status: "idle", message: "" });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

describe("MarketplaceUsers", () => {
  it("shows each registered person with their shops and product visibility", () => {
    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: true,
                products: [
                  {
                    id: 11,
                    name: "Taza de barro",
                    slug: "taza",
                    state: "public",
                    isAdminEnabled: true,
                    effectiveVisibility: true,
                    expiresAt: "2026-09-03T00:00:00.000Z",
                    createdAt: "2026-08-03T00:00:00.000Z",
                    updatedAt: "2026-08-04T00:00:00.000Z",
                  },
                  {
                    id: 12,
                    name: "Jarrón en proceso",
                    slug: "jarron-en-proceso",
                    state: "draft",
                    isAdminEnabled: true,
                    effectiveVisibility: false,
                    expiresAt: null,
                    createdAt: "2026-08-05T00:00:00.000Z",
                    updatedAt: "2026-08-06T00:00:00.000Z",
                  },
                ],
              },
              {
                id: 2,
                name: "Bodega Volcán",
                slug: "bodega-volcan",
                createdAt: "2026-08-07T00:00:00.000Z",
                isPublishingApproved: false,
                products: [],
              },
            ],
          },
          {
            id: "persona-2",
            email: null,
            displayName: null,
            createdAt: "2026-08-08T00:00:00.000Z",
            shops: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("2 personas registradas")).toBeInTheDocument();
    expect(screen.getByText("Lucía Martínez")).toBeInTheDocument();
    expect(screen.getByText("lucia@tallervolcan.mx")).toBeInTheDocument();
    expect(screen.getByText("Registro: 1 de agosto de 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Taller Volcán" })).toHaveAttribute(
      "href",
      "/tiendas/taller-volcan",
    );
    expect(screen.getByText("Creada: 2 de agosto de 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Taza de barro" })).toHaveAttribute(
      "href",
      "/productos/taza",
    );
    expect(
      screen.getByText("Creado: 3 de agosto de 2026 · Actualizado: 4 de agosto de 2026"),
    ).toBeInTheDocument();
    expect(screen.getByText("Jarrón en proceso").closest("a")).toBeNull();
    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText("Sin borradores ni publicaciones")).toBeInTheDocument();
    expect(screen.getByText("Sin correo registrado")).toBeInTheDocument();
    expect(screen.getByText("Sin tiendas")).toBeInTheDocument();
  });

  it("submits the opposite shop approval without optimistically changing the switch", async () => {
    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: false,
                products: [],
              },
            ],
          },
        ]}
      />,
    );

    const approval = screen.getByRole("switch", { name: "Publicaciones habilitadas" });
    expect(approval).not.toBeChecked();
    expect(screen.getByText("Publicaciones pendientes")).toBeInTheDocument();
    expect(screen.getByText("Deshabilitar la tienda oculta sus productos sin cambiar las decisiones del vendedor.")).toBeInTheDocument();

    fireEvent.click(approval);

    await waitFor(() => expect(setShopPublishingApproval).toHaveBeenCalledOnce());
    const submitted = vi.mocked(setShopPublishingApproval).mock.calls[0]?.[1];
    expect(submitted?.get("shop_id")).toBe("1");
    expect(submitted?.get("enabled")).toBe("true");
    expect(approval).not.toBeChecked();
  });

  it("disables the approval switch while its update is pending", async () => {
    const update = deferred<{ status: "success"; message: string }>();
    vi.mocked(setShopPublishingApproval).mockReturnValueOnce(update.promise);

    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: true,
                products: [],
              },
            ],
          },
        ]}
      />,
    );

    const approval = screen.getByRole("switch", { name: "Publicaciones habilitadas" });
    fireEvent.click(approval);

    await waitFor(() => expect(approval).toBeDisabled());
    update.resolve({ status: "success", message: "Publicaciones habilitadas." });
  });

  it("announces an approval error returned by the server", async () => {
    vi.mocked(setShopPublishingApproval).mockResolvedValueOnce({
      status: "error",
      message: "No pudimos actualizar la aprobación de publicaciones.",
    });

    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: true,
                products: [],
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Publicaciones habilitadas" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("No pudimos actualizar la aprobación de publicaciones.");
    expect(status).toHaveClass("text-sale");
  });

  it("announces approval success returned by the server", async () => {
    vi.mocked(setShopPublishingApproval).mockResolvedValueOnce({
      status: "success",
      message: "Publicaciones habilitadas.",
    });

    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: false,
                products: [],
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Publicaciones habilitadas" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Publicaciones habilitadas.");
    expect(status).toHaveClass("text-success");
  });

  it("links products publicly only when all visibility gates are effective", () => {
    render(
      <MarketplaceUsers
        users={[
          {
            id: "persona-1",
            email: "lucia@tallervolcan.mx",
            displayName: "Lucía Martínez",
            createdAt: "2026-08-01T00:00:00.000Z",
            shops: [
              {
                id: 1,
                name: "Taller Volcán",
                slug: "taller-volcan",
                createdAt: "2026-08-02T00:00:00.000Z",
                isPublishingApproved: false,
                products: [
                  {
                    id: 11,
                    name: "Taza visible",
                    slug: "taza-visible",
                    state: "public",
                    isAdminEnabled: true,
                    effectiveVisibility: true,
                    expiresAt: "2026-09-03T00:00:00.000Z",
                    createdAt: "2026-08-03T00:00:00.000Z",
                    updatedAt: "2026-08-04T00:00:00.000Z",
                  },
                  {
                    id: 12,
                    name: "Taza pendiente",
                    slug: "taza-pendiente",
                    state: "pending",
                    isAdminEnabled: true,
                    effectiveVisibility: false,
                    expiresAt: null,
                    createdAt: "2026-08-03T00:00:00.000Z",
                    updatedAt: "2026-08-04T00:00:00.000Z",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Taza visible" })).toHaveAttribute(
      "href",
      "/productos/taza-visible",
    );
    expect(screen.getByText("Taza pendiente").closest("a")).toBeNull();
    expect(screen.getByText("Pendiente de aprobación")).toBeInTheDocument();
  });

  it.each([
    ["draft", "Borrador"],
    ["pending", "Pendiente de aprobación"],
    ["public", "Publicado"],
    ["admin-disabled", "Deshabilitado por administración"],
    ["expired", "Vencido"],
  ] as const)("renders the effective %s product state as %s", (state, label) => {
    render(
      <MarketplaceUsers
        users={[{
          id: "persona-1",
          email: "lucia@tallervolcan.mx",
          displayName: "Lucía Martínez",
          createdAt: "2026-08-01T00:00:00.000Z",
          shops: [{
            id: 1,
            name: "Taller Volcán",
            slug: "taller-volcan",
            createdAt: "2026-08-02T00:00:00.000Z",
            isPublishingApproved: true,
            products: [{
              id: 11,
              name: "Taza de barro",
              slug: "taza",
              state,
              isAdminEnabled: state !== "admin-disabled",
              effectiveVisibility: state === "public",
              expiresAt: state === "draft" ? null : "2027-09-03T00:00:00.000Z",
              createdAt: "2026-08-03T00:00:00.000Z",
              updatedAt: "2026-08-04T00:00:00.000Z",
            }],
          }],
        }]}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows an empty state when no people are registered", () => {
    render(<MarketplaceUsers users={[]} />);

    expect(screen.getByText("No hay personas registradas")).toBeInTheDocument();
  });
});
