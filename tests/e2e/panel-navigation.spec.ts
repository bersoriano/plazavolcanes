import { execFileSync } from "node:child_process";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { pickOption } from "./pick-option";

// Like the other end-to-end specs, this one registers a real account, so it
// must never reach the linked remote project. `npm run test:e2e` forces the
// local stack through scripts/e2e-env.mjs; running Playwright bare skips that.
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const SECTIONS = ["Resumen", "Pedidos", "Tiendas", "Cuenta"] as const;

// The local service role intentionally lacks table privileges. Fixture writes
// use the local database owner instead of altering application grants or RLS.
function localQuery(sql: string) {
  const result = execFileSync("npx", ["supabase", "db", "query", "--local", "--output-format", "json", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.trim().startsWith("{") ? JSON.parse(result) : { rows: [] };
}

/** The bar marks exactly one area, and it is the one named. */
async function expectOpen(bar: Locator, section: (typeof SECTIONS)[number]) {
  for (const name of SECTIONS) {
    const link = bar.getByRole("link", { name, exact: true });
    if (name === section) await expect(link).toHaveAttribute("aria-current", "page");
    else await expect(link).not.toHaveAttribute("aria-current");
  }
}

async function open(page: Page, bar: Locator, section: (typeof SECTIONS)[number], url: RegExp) {
  await bar.getByRole("link", { name: section, exact: true }).click();
  await expect(page).toHaveURL(url);
  await expectOpen(bar, section);
}

test("the panel's bar carries a seller between its areas from any page", async ({ page }) => {
  test.setTimeout(90_000);
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(apiUrl)) throw new Error("Use local services only.");
  const status = JSON.parse(
    execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }),
  );
  expect(status.API_URL).toBe(apiUrl);
  const admin = createClient(apiUrl, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const email = `panel-nav-${crypto.randomUUID()}@test.local`;
  const shopName = `Casa Barra ${Date.now()}-${process.pid}`;
  let ownerId: string | null = null;

  try {
    await page.goto("/registro?intent=vender");
    await page.getByLabel("Tu nombre").fill("Vendedora Barra");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Teléfono móvil").fill("3312345678");
    await page.getByLabel("Contraseña", { exact: true }).fill("plaza-volcanes-barra-1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
    ownerId = localQuery(`select id from auth.users where email = '${email}'`).rows[0]?.id ?? null;

    // The bar is there before the seller has anything, and already knows that
    // a new shop belongs to the shops.
    const bar = page.getByRole("navigation", { name: "Secciones del panel" });
    await expectOpen(bar, "Tiendas");

    await page.getByLabel("Nombre de la tienda").fill(shopName);
    await page.getByLabel("Descripción").fill("Objetos de barro hechos a mano en México.");
    await pickOption(page.getByLabel("Estado principal"), "MX-JAL");
    await page.getByRole("button", { name: "Crear tienda", exact: true }).click();
    await expect(page).toHaveURL(/\/panel\/tiendas\/\d+\?creada=1$/);
    const shopPath = new URL(page.url()).pathname;
    await expectOpen(bar, "Tiendas");

    // The pages below the bar no longer carry their own way back to the panel.
    await expect(page.locator('main a[href="/panel"]')).toHaveCount(1);

    // From a shop straight to orders, then the account: no detour.
    await open(page, bar, "Pedidos", /\/panel\/pedidos$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pedidos" })).toBeVisible();
    await open(page, bar, "Cuenta", /\/panel\/cuenta$/);
    await open(page, bar, "Resumen", /\/panel$/);
    await expect(page.getByRole("heading", { level: 1, name: "Panel de ventas" })).toBeVisible();

    // One shop and no room for another: "Tiendas" is that shop.
    await open(page, bar, "Tiendas", new RegExp(`${shopPath}$`));
    await expect(page.getByRole("heading", { level: 1, name: shopName })).toBeVisible();

    // A product's editor sits outside the shop's path and still belongs to it.
    await page.goto(`${shopPath}/productos/nuevo`);
    await expectOpen(bar, "Tiendas");
    await expect(page.getByRole("main").getByRole("link", { name: shopName })).toHaveAttribute("href", shopPath);

    // With room for a second shop the same link opens the list instead.
    localQuery(`insert into private.user_shop_limits (user_id, shop_limit) values ('${ownerId}', 2)`);
    await open(page, bar, "Tiendas", /\/panel\/tiendas$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mis tiendas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Crear tienda" })).toHaveAttribute("href", "/panel/tiendas/nueva");
    await expect(page.getByRole("link", { name: new RegExp(shopName) })).toHaveAttribute("href", shopPath);

    // On the narrowest phone the row may scroll; the page must not.
    await page.setViewportSize({ height: 700, width: 320 });
    for (const route of ["/panel", "/panel/tiendas", shopPath, "/panel/pedidos"]) {
      await page.goto(route);
      await expect(bar).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth), { message: `sideways scroll on ${route}` })
        .toBe(320);
    }
    // The last area starts out past the edge here. Opened directly, its mark
    // must still be on screen: it is the only thing saying where this is.
    await page.goto("/panel/cuenta");
    await expectOpen(bar, "Cuenta");
    await expect(bar.getByRole("link", { name: "Cuenta", exact: true })).toBeInViewport({ ratio: 1 });
    // And the first is a tap away again from the far end of the row.
    await open(page, bar, "Resumen", /\/panel$/);
  } finally {
    if (ownerId) {
      localQuery(`delete from public.shops where owner_id = '${ownerId}'`);
      expect((await admin.auth.admin.deleteUser(ownerId)).error).toBeNull();
    }
  }
});
