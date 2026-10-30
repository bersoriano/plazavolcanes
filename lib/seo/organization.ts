import {
  BASE_LISTING_LIMIT,
  FOUNDER_COMMISSION_LOCK_MONTHS,
  FOUNDER_EARN_RULE,
  FOUNDER_LISTING_LIMIT,
  FOUNDERS_CAP,
} from "@/lib/launch";
import { SITE_NAME } from "@/lib/seo/home-metadata";
import { buildSiteUrl } from "@/lib/site-url";

export const ORGANIZATION_DESCRIPTION =
  "Plataforma 100% mexicana para tiendas independientes. Publica productos nuevos o usados y recibe el pago directo de cada cliente, sin comisión en pago directo ni retenciones.";

/** One id for the publisher, so every page's graph points at the same node. */
export function organizationId() {
  return buildSiteUrl("/#organization");
}

/** Who runs the plaza and what it is about, for search engines and AI answers. */
export function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: SITE_NAME,
    url: buildSiteUrl("/"),
    description: ORGANIZATION_DESCRIPTION,
    areaServed: "MX",
    knowsAbout: [
      "marketplace independiente México",
      "venta sin comisión",
      "pago directo",
      "tiendas independientes",
      "productos nuevos y usados",
    ],
  };
}

/**
 * What a seller gets: a free shop and, while the promotion is open, the
 * founders package. `foundersOpen` false leaves the founders offer out, the
 * same way /vender drops it once the seats run out.
 */
export function sellerServiceSchema({ foundersOpen }: { foundersOpen: boolean }) {
  const free = {
    "@type": "Offer",
    name: "Tienda gratis",
    description: `${BASE_LISTING_LIMIT} productos en vivo gratis, sin costo por publicar y sin comisión en pago directo.`,
    price: "0",
    priceCurrency: "MXN",
  };
  const founders = {
    "@type": "Offer",
    name: "Paquete de tienda fundadora",
    description: `Primeras ${FOUNDERS_CAP} tiendas: ${FOUNDER_LISTING_LIMIT} productos, insignia fundadora y 0% comisión fija ${FOUNDER_COMMISSION_LOCK_MONTHS} meses. ${FOUNDER_EARN_RULE}`,
    price: "0",
    priceCurrency: "MXN",
  };

  return {
    "@type": "Service",
    name: "Tienda independiente en Plaza Volcanes",
    serviceType: "Marketplace para tiendas independientes",
    url: buildSiteUrl("/vender"),
    provider: { "@id": organizationId() },
    areaServed: "MX",
    offers: foundersOpen ? [free, founders] : [free],
  };
}
