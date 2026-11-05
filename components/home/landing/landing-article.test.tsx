import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LandingArticle } from "@/components/home/landing/landing-article";

afterEach(cleanup);

const post = {
  slug: "cuanto-te-queda",
  title: "Vendiste en $1,000. ¿Cuánto te quedó?",
  description: "La cuenta de una venta, paso a paso.",
  date: "2026-11-05",
  draft: false,
};

describe("LandingArticle", () => {
  it("briefs the post under its own title and links to it", () => {
    render(<LandingArticle post={post} />);

    const section = screen.getByRole("region", { name: post.title });
    expect(within(section).getByRole("heading", { level: 2, name: post.title })).toBeInTheDocument();
    expect(within(section).getByText(post.description)).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Leer el artículo" })).toHaveAttribute(
      "href",
      "/blog/cuanto-te-queda",
    );
  });
});
