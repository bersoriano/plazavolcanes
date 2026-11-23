/**
 * Which pages Google Analytics may see, and how they are grouped in reports.
 *
 * An allowlist, not a denylist: a route added later stays private until it is
 * listed here. Signed-in areas (/panel, /admin, /mensajes, /compras, /carrito)
 * and the auth pages that follow a one-time link (/recuperar,
 * /nueva-contrasena, /confirmar-correo) are deliberately absent. Reaching one
 * by client-side navigation stops collection until the next full page load
 * (see lib/analytics.client.ts).
 */
import type { PageType } from "@/lib/analytics";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

const LEGAL_PATHS = new Set(LEGAL_ROUTES.map((route) => route.path));

const PAGES = new Map<string, PageType>([
  ["/", "landing"],
  ["/vender", "landing"],
  ["/blog", "blog_index"],
  ["/explorar", "catalog"],
  ["/como-comprar", "supporting"],
  ["/registro", "auth"],
  ["/ingresar", "auth"],
  ...[...LEGAL_PATHS].map((path) => [path, "legal"] as const),
]);

/** One public slug below these prefixes, nothing deeper. */
const SLUG_PAGES: [RegExp, PageType][] = [
  [/^\/blog\/[^/]+$/, "blog_post"],
  [/^\/productos\/[^/]+$/, "product"],
  [/^\/tiendas\/[^/]+$/, "shop"],
  [/^\/estado\/[^/]+$/, "catalog"],
];

function pageType(pathname: string): PageType | undefined {
  return PAGES.get(pathname) ?? SLUG_PAGES.find(([pattern]) => pattern.test(pathname))?.[1];
}

export function isPublicAnalyticsPath(pathname: string): boolean {
  return pageType(pathname) !== undefined;
}

/** Custom dimensions for a page view. Only called for public paths. */
export function analyticsPageParams(pathname: string): { page_type: PageType } {
  return { page_type: pageType(pathname) ?? "supporting" };
}
