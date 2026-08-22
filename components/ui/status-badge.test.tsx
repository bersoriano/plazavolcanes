import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatusBadge } from "@/components/ui/status-badge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("names each listing state", () => {
    for (const [status, label] of [
      ["draft", "Borrador"],
      ["published", "Publicado"],
      ["expired", "Vencido"],
    ] as const) {
      cleanup();
      render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
