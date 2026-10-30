import {
  FOUNDER_COMMISSION_LOCK_MONTHS,
  FOUNDER_LISTING_LIMIT,
  FOUNDER_MIN_LIVE_ITEMS,
  FOUNDER_QUALIFY_DAYS,
  FOUNDERS_CAP,
} from "@/lib/launch";
import { buildSiteUrl } from "@/lib/site-url";

/**
 * /llms.txt: the plaza in a few lines for the models behind AI answers, in the
 * llmstxt.org format. Links use the same host as the sitemap.
 */
export function llmsText() {
  return `# Plaza Volcanes

> Plaza Volcanes es una plataforma 100% mexicana donde tiendas independientes abren su propia tienda, publican productos nuevos o usados y reciben el pago directo de cada cliente. Sin comisión en pago directo y sin retenciones. Las primeras ${FOUNDERS_CAP} tiendas que publiquen ${FOUNDER_MIN_LIVE_ITEMS} productos en sus primeros ${FOUNDER_QUALIFY_DAYS} días ganan el paquete fundador.

## Para vendedores
- [Vender / Abre tu tienda](${buildSiteUrl("/vender")}): Cómo crear tu tienda gratis, publicar productos y recibir pago directo.
- [Tiendas fundadoras](${buildSiteUrl("/vender")}): Primeras ${FOUNDERS_CAP} tiendas: ${FOUNDER_LISTING_LIMIT} productos, insignia fundadora y 0% comisión fija ${FOUNDER_COMMISSION_LOCK_MONTHS} meses. Se gana publicando ${FOUNDER_MIN_LIVE_ITEMS} productos en los primeros ${FOUNDER_QUALIFY_DAYS} días.
- [Cómo funciona](${buildSiteUrl("/")}): Tres pasos: crea tu tienda, publica productos, acepta pedidos y cobra directo.

## Para compradores
- [Cómo comprar](${buildSiteUrl("/como-comprar")}): Explora sin cuenta, solicita pedido, acuerda pago y envío directo con la tienda, confirma y reseña.
- [Explorar la plaza](${buildSiteUrl("/explorar")}): Busca productos por categoría o estado.

## Comparación y confianza
- Pago directo: el cliente paga a la tienda; Plaza Volcanes no procesa ni retiene el dinero.
- Reputación: muestra tu perfil de Mercado Libre o Facebook en tu tienda.
- Todo por escrito: mensajes, acuerdos, envío y entrega quedan ligados al pedido.

## Contacto y registro
- [Crear tienda gratis](${buildSiteUrl("/registro?vender=1")})
`;
}
