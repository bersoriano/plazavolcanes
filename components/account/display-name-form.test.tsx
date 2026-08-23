import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { DisplayNameForm } from "@/components/account/display-name-form";

afterEach(cleanup);

test("shows the name a person already set", () => {
  render(<DisplayNameForm action={vi.fn()} displayName="Ana Ruiz" />);

  expect(screen.getByLabelText(/tu nombre/i)).toHaveValue("Ana Ruiz");
});

test("starts empty when a person has no name yet", () => {
  render(<DisplayNameForm action={vi.fn()} displayName={null} />);

  expect(screen.getByLabelText(/tu nombre/i)).toHaveValue("");
});

test("explains who will see the name", () => {
  render(<DisplayNameForm action={vi.fn()} displayName={null} />);

  expect(screen.getByText(/solo lo ven las tiendas/i)).toBeInTheDocument();
});

test("invites a person with no name to add one", () => {
  render(<DisplayNameForm action={vi.fn()} displayName={null} />);

  expect(screen.getByRole("status")).toHaveTextContent(/agrega tu nombre/i);
});
