import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ListingImportCard } from "@/components/shops/listing-import-card";

afterEach(cleanup);

describe("ListingImportCard", () => {
  it("asks for links and shows where each request stands", () => {
    render(
      <ListingImportCard
        action={vi.fn()}
        requests={[
          { id: 2, link_count: 12, status: "pending", created_at: "2026-09-27T12:00:00Z", handled_at: null },
          { id: 1, link_count: 1, status: "done", created_at: "2026-09-20T12:00:00Z", handled_at: "2026-09-21T12:00:00Z" },
        ]}
      />,
    );

    expect(screen.getByText("Trae tus productos")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Enlaces a tus publicaciones/ })).toBeRequired();
    expect(screen.getByText("En espera")).toBeInTheDocument();
    expect(screen.getByText("Borradores listos")).toBeInTheDocument();
    expect(screen.getByText(/^12 enlaces/)).toBeInTheDocument();
  });
});
