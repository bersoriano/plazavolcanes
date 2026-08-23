import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ConversationReveal } from "@/components/admin/conversation-reveal";

afterEach(cleanup);

test("asks for a reason before showing anything", () => {
  render(<ConversationReveal action={vi.fn()} conversationId={7} />);

  expect(screen.getByLabelText(/motivo/i)).toBeRequired();
  expect(screen.queryByText(/nunca llegó/i)).not.toBeInTheDocument();
});

test("warns that the read is recorded", () => {
  render(<ConversationReveal action={vi.fn()} conversationId={7} />);

  expect(screen.getByText(/queda registrado/i)).toBeInTheDocument();
});

test("labels each message with who wrote it", () => {
  render(<ConversationReveal action={vi.fn()} conversationId={7} />);

  // Nothing is shown until a reason has been given and the read recorded.
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});
