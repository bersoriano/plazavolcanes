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
  "/recuperar",
  "/nueva-contrasena",
];

// Search engines and the crawlers behind AI answers (ChatGPT, Perplexity,
// Claude), named so the welcome is explicit. A crawler with its own group
// ignores the `*` one, so each repeats the private paths.
const SEARCH_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "Claude-SearchBot",
  "Claude-User",
  "Googlebot",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: SEARCH_CRAWLERS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: buildSiteUrl("/sitemap.xml"),
    host: getSiteUrl(),
  };
}
