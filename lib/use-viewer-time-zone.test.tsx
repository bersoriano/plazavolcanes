import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";

import { useViewerTimeZone } from "@/lib/use-viewer-time-zone";

function Zone() {
  return <p>{useViewerTimeZone()}</p>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function browserZone(timeZone: string) {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
    this: Intl.DateTimeFormat,
  ) {
    return { ...real.call(this), timeZone };
  });
}

test("keeps the plaza's clock while rendering on the server", () => {
  browserZone("America/Tijuana");

  expect(renderToString(<Zone />)).toContain("America/Mexico_City");
});

test("moves to the reader's own zone in the browser", () => {
  browserZone("America/Tijuana");
  render(<Zone />);

  expect(screen.getByText("America/Tijuana")).toBeInTheDocument();
});
