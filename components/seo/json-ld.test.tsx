import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JsonLd } from "@/components/seo/json-ld";

describe("JsonLd", () => {
  it("writes structured data that a seller's text cannot break out of", () => {
    const data = { "@type": "Product", description: "Hecho a mano </script><script>alert(1)</script>" };
    const { container } = render(<JsonLd data={data} />);
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script?.innerHTML).not.toContain("</script>");
    expect(JSON.parse(script?.textContent ?? "")).toEqual(data);
  });
});
