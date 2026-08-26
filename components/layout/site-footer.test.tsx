import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";

afterEach(cleanup);

describe("SiteFooter", () => {
  it("keeps every navigation destination at least 44px tall", () => {
    render(<SiteFooter />);

    const footer = screen.getByRole("contentinfo");
    const links = within(footer).getAllByRole("link");

    expect(links).not.toHaveLength(0);
    for (const link of links) {
      expect(link).toHaveClass("inline-flex", "min-h-11", "items-center");
    }
  });
});
