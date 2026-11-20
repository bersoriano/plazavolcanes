import { describe, expect, it } from "vitest";

import { analyticsPageParams, isPublicAnalyticsPath } from "@/lib/analytics-pages";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

describe("isPublicAnalyticsPath", () => {
  it.each([
    "/",
    "/vender",
    "/explorar",
    "/como-comprar",
    "/blog",
    "/blog/tienda-propia-o-mercado-libre",
    "/productos/jarron-de-barro",
    "/tiendas/alfareria-puebla",
    "/estado/jalisco",
    "/registro",
    "/ingresar",
    ...LEGAL_ROUTES.map((route) => route.path),
  ])("measures the public page %s", (path) => {
    expect(isPublicAnalyticsPath(path)).toBe(true);
  });

  it.each([
    // Signed-in areas: what a customer does there stays out of analytics.
    "/panel",
    "/panel/tiendas/nueva",
    "/panel/tiendas/12/productos/nuevo",
    "/admin/usuarios",
    "/mensajes",
    "/mensajes/8f2c",
    "/compras",
    "/compras/91",
    "/carrito/4",
    // Auth flows that carry or follow a one-time credential.
    "/recuperar",
    "/nueva-contrasena",
    "/confirmar-correo",
    "/auth/confirm",
    // Unknown and nested paths are private until listed.
    "/tiendas/alfareria-puebla/privado",
    "/productos",
    "/vender/extra",
    "/blog/",
    "/llms.txt",
  ])("leaves %s out", (path) => {
    expect(isPublicAnalyticsPath(path)).toBe(false);
  });
});

describe("analyticsPageParams", () => {
  it.each([
    ["/", "landing"],
    ["/vender", "landing"],
    ["/blog", "blog_index"],
    ["/blog/tienda-propia-o-mercado-libre", "blog_post"],
    ["/explorar", "catalog"],
    ["/estado/jalisco", "catalog"],
    ["/productos/jarron-de-barro", "product"],
    ["/tiendas/alfareria-puebla", "shop"],
    ["/registro", "auth"],
    ["/ingresar", "auth"],
    ["/privacidad", "legal"],
    ["/quejas-y-aclaraciones", "legal"],
    ["/como-comprar", "supporting"],
  ])("groups %s as %s", (path, pageType) => {
    expect(analyticsPageParams(path)).toEqual({ page_type: pageType });
  });
});
