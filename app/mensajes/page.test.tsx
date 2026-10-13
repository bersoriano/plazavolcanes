import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import MessagesPage from "@/app/mensajes/page";

afterEach(cleanup);

test("invites the reader to open a conversation while none is open", () => {
  render(<MessagesPage />);

  expect(screen.getByRole("heading", { level: 2, name: "Elige una conversación" })).toBeInTheDocument();
});
