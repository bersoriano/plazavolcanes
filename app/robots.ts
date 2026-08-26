import type { MetadataRoute } from "next";

import { buildSiteUrl, getSiteUrl } from "@/lib/site-url";

// Everything behind a session — the panel, orders, messages, the cart and the
// auth routes — has nothing to offer a crawler and would only spend budget on
// pages that redirect to sign-in.
const PRIVATE_PATHS = [
  "/admin/",
  "/panel/",
  "/compras/",
  "/mensajes/",
  "/carrito/",
  "/auth/",
  "/api/",
  "/ingresar",
  "/registro",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: buildSiteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
