import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { reactivateExpiredListings } = vi.hoisted(() => ({
  reactivateExpiredListings: vi.fn(async () => ({ status: "success" as const, message: "Reactivamos 2 productos." })),
}));
vi.mock("@/lib/actions/catalog", () => ({ reactivateExpiredListings }));

const { ReactivateExpiredButton } = await import("@/components/products/reactivate-expired-button");

afterEach(cleanup);

describe("ReactivateExpiredButton", () => {
  it("keeps its result in view after the last expired listing comes back", async () => {
    const { rerender } = render(<ReactivateExpiredButton count={2} shopId={6} />);

    fireEvent.click(screen.getByRole("button", { name: "Reactivar todos (2)" }));
    await screen.findByText("Reactivamos 2 productos.");

    // The page refreshes with nothing expired left; the result must not vanish with the button.
    rerender(<ReactivateExpiredButton count={0} shopId={6} />);

    expect(screen.queryByRole("button", { name: /Reactivar todos/ })).not.toBeInTheDocument();
    expect(screen.getByText("Reactivamos 2 productos.")).toBeInTheDocument();
  });

  it("shows nothing when there is nothing to reactivate and nothing to report", () => {
    const { container } = render(<ReactivateExpiredButton count={0} shopId={6} />);

    expect(container).toBeEmptyDOMElement();
  });
});
