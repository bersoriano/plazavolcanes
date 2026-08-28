import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketplaceUsers } from "@/components/admin/marketplace-users";

afterEach(cleanup);

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
                products: [
                  {
                    id: 11,
                    name: "Taza de barro",
                    slug: "taza",
                    status: "published",
                    createdAt: "2026-08-03T00:00:00.000Z",
                    updatedAt: "2026-08-04T00:00:00.000Z",
                  },
                  {
                    id: 12,
                    name: "Jarrón en proceso",
                    slug: "jarron-en-proceso",
                    status: "draft",
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
    expect(screen.getByRole("link", { name: "Taller Volcán" })).toHaveAttribute(
      "href",
      "/tiendas/taller-volcan",
    );
    expect(screen.getByRole("link", { name: "Taza de barro" })).toHaveAttribute(
      "href",
      "/productos/taza",
    );
    expect(screen.getByText("Jarrón en proceso").closest("a")).toBeNull();
    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.getByText("Borrador")).toBeInTheDocument();
    expect(screen.getByText("Sin borradores ni publicaciones")).toBeInTheDocument();
    expect(screen.getByText("Sin correo registrado")).toBeInTheDocument();
    expect(screen.getByText("Sin tiendas")).toBeInTheDocument();
  });

  it("shows an empty state when no people are registered", () => {
    render(<MarketplaceUsers users={[]} />);

    expect(screen.getByText("No hay personas registradas")).toBeInTheDocument();
  });
});
