import { afterEach, describe, expect, it, vi } from "vitest";

import { organizationSchema, sellerServiceSchema } from "@/lib/seo/organization";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("organization structured data", () => {
  it("describes the plaza for search engines and AI answers", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");

    expect(organizationSchema()).toEqual(
      expect.objectContaining({
        "@type": "Organization",
        "@id": "https://plazavolcanes.com/#organization",
        name: "Plaza Volcanes",
        url: "https://plazavolcanes.com/",
        areaServed: "MX",
        knowsAbout: expect.arrayContaining(["venta sin comisión", "pago directo"]),
      }),
    );
  });

  it("offers the founders package only while its seats are open", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://plazavolcanes.com");

    const open = sellerServiceSchema({ foundersOpen: true });
    const closed = sellerServiceSchema({ foundersOpen: false });

    expect(open.provider).toEqual({ "@id": "https://plazavolcanes.com/#organization" });
    expect(open.offers.map((offer) => offer.name)).toEqual(["Tienda gratis", "Paquete de tienda fundadora"]);
    expect(open.offers[1].description).toContain("0% comisión fija 12 meses");
    expect(closed.offers.map((offer) => offer.name)).toEqual(["Tienda gratis"]);
  });
});
