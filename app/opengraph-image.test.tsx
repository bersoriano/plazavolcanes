import { describe, expect, it } from "vitest";

import OpengraphImage, { alt, contentType, size } from "@/app/opengraph-image";

describe("home share image", () => {
  it("is a large-card PNG that says what it shows", () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
    expect(alt).toBe("Plaza Volcanes: vende lo tuyo y quédate con todo");
    expect(OpengraphImage).toBeTypeOf("function");
  });
});
