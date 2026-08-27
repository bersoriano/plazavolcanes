import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

afterEach(cleanup);

describe("SiteFooter", () => {
  it("exposes every legal route", () => {
    render(<SiteFooter />);

    const legal = screen.getByRole("navigation", { name: "Información legal" });

    for (const route of LEGAL_ROUTES) {
      expect(
        within(legal).getByRole("link", { name: route.navLabel }),
      ).toHaveAttribute("href", route.path);
    }
  });

  it("keeps the existing browse links", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Explorar" })).toHaveAttribute("href", "/");
  });

  it("keeps the print stylesheet marker", () => {
    render(<SiteFooter />);

    expect(document.querySelector("footer")).toHaveAttribute("data-site-footer");
  });
});
