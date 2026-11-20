import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LandingArticle } from "@/components/home/landing/landing-article";

afterEach(cleanup);

const newest = {
  slug: "tienda-propia",
  title: "¿Tienda propia o Mercado Libre?",
  description: "Cuándo te conviene cada una.",
  date: "2026-11-19",
  draft: false,
};
const older = {
  slug: "cuanto-te-queda",
  title: "Vendiste en $1,000. ¿Cuánto te quedó?",
  description: "La cuenta de una venta, paso a paso.",
  date: "2026-11-05",
  draft: false,
};
const oldest = { ...older, slug: "la-primera", title: "La primera", date: "2026-10-01" };
const beyond = { ...older, slug: "la-cuarta", title: "La cuarta", date: "2026-09-01" };

/** A row link reads its title, then its date. */
const titled = (title: string) => (name: string) => name.startsWith(title);

describe("LandingArticle", () => {
  it("briefs the newest post under its own title and links to it", () => {
    render(<LandingArticle posts={[newest]} />);

    const section = screen.getByRole("region", { name: "Del blog" });
    expect(within(section).getByRole("heading", { level: 2, name: newest.title })).toBeInTheDocument();
    expect(within(section).getByText(newest.description)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Leer el artículo" })).toHaveAttribute(
      "href",
      "/blog/tienda-propia",
    );
    expect(within(section).queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists the older posts under the newest, each linking to its page with its date", () => {
    render(<LandingArticle posts={[newest, older]} />);

    const section = screen.getByRole("region", { name: "Del blog" });
    expect(within(section).getByRole("heading", { level: 2, name: newest.title })).toBeInTheDocument();
    const rows = within(within(section).getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByRole("link", { name: titled(older.title) })).toHaveAttribute("href", "/blog/cuanto-te-queda");
    expect(within(rows[0]).getByText("5 de noviembre de 2026")).toHaveAttribute("datetime", "2026-11-05");
  });

  it("shows the newest three posts at most", () => {
    render(<LandingArticle posts={[newest, older, oldest, beyond]} />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: titled(oldest.title) })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: titled(beyond.title) })).not.toBeInTheDocument();
  });

  it("points to the whole blog", () => {
    render(<LandingArticle posts={[newest, older]} />);

    expect(screen.getByRole("link", { name: "Ver todo el blog" })).toHaveAttribute("href", "/blog");
  });
});
