import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

test("shop creation, approval, storefront and trust states", async ({ page }) => {
  test.setTimeout(90_000);
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(apiUrl)) throw new Error("Use local services only.");
  const status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  expect(status.API_URL).toBe(apiUrl);
  const admin = createClient(apiUrl, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `shop-feedback-${crypto.randomUUID()}@test.local`;
  await page.goto("/registro?intent=vender");
  await page.getByLabel("Tu nombre").fill("Vendedor Prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña", { exact: true }).fill("plaza-volcanes-feedback-1");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
  await page.getByLabel("Nombre de la tienda").fill("Casa Volcanes Prueba");
  await page.getByLabel("Descripción").fill("Objetos de barro hechos a mano en México.");
  await page.getByLabel("Estado principal").selectOption("MX-JAL");
  await page.getByRole("button", { name: "Crear tienda", exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/tiendas\/\d+\?creada=1$/);
  const workspace = page.url();
  const shopId = Number(new URL(workspace).pathname.split("/").at(-1));
  expect(Number.isSafeInteger(shopId) && shopId > 0).toBe(true);
  // The local service role intentionally lacks table privileges. Fixture writes
  // use the local database owner instead of altering application grants or RLS.
  function localQuery(sql: string) {
    const result = execFileSync("npx", ["supabase", "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return result.trim().startsWith("{") ? JSON.parse(result) : { rows: [] };
  }
  const shop = localQuery(`select slug, owner_id from public.shops where id = ${shopId}`).rows[0];
  try {
    await expect(page.getByRole("status")).toContainText("Tu tienda se creó correctamente.");
    await expect(page.getByText("Esperando aprobación de administración", { exact: true })).toBeVisible();
    await expect(page.getByText(/Puedes guardar borradores privados/)).toBeVisible();
    await page.screenshot({ path: "output/playwright/shop-created-pending.png", fullPage: true });
    await page.getByRole("link", { name: "Agregar mi primer producto", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/panel/tiendas/${shopId}/productos/nuevo$`));
    await page.goto(workspace);
    await page.getByText("Confianza", { exact: true }).click();
    await expect(page.getByText(/Estamos reuniendo evidencia/)).toBeVisible();
    await expect(page.getByText("Cumples el nivel máximo.", { exact: true })).toHaveCount(0);
    await page.locator("details").filter({ has: page.getByText("Confianza", { exact: true }) }).screenshot({ path: "output/playwright/trust-unevaluated.png" });
    await page.goto(`/tiendas/${shop!.slug}`);
    await expect(page.getByRole("heading", { name: "Casa Volcanes Prueba", exact: true })).toBeVisible();

    localQuery(`update public.shops set is_publishing_approved = true, publishing_reviewed_at = now() where id = ${shopId}`);
    await page.goto(workspace.split("?")[0]);
    await expect(page.getByText("Publicación de productos aprobada", { exact: true })).toBeVisible();
    await expect(page.getByText("Tu tienda se creó correctamente.")).toHaveCount(0);
    await page.screenshot({ path: "output/playwright/shop-approved.png", fullPage: true });

    localQuery(`update public.shops set is_publishing_approved = false, publishing_reviewed_at = now(), trust_tier = 'top_rated', listing_limit = 100 where id = ${shopId}`);
    localQuery(`insert into public.shop_trust_evaluations (shop_id, open_dispute_count, metric_qualified_tier, effective_tier, free_listing_limit, reasons, next_tier_requirements, summary) values (${shopId}, 0, 'top_rated', 'top_rated', 100, '["Servicio evaluado."]', '[]', 'Tu tienda mantiene el nivel Mejor valorada.')`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByText("Tienda deshabilitada por administración", { exact: true })).toBeVisible();
    await expect(page.getByText(/Puedes seguir preparando borradores privados/)).toBeVisible();
    await page.screenshot({ path: "output/playwright/shop-disabled-mobile.png", fullPage: true });
    await page.getByText("Confianza", { exact: true }).click();
    await expect(page.getByText("Cumples el nivel máximo.", { exact: true })).toBeVisible();
    await page.locator("details").filter({ has: page.getByText("Confianza", { exact: true }) }).screenshot({ path: "output/playwright/trust-maximum-mobile.png", style: "nav.fixed { visibility: hidden; }" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    localQuery(`delete from public.shops where id = ${shopId}`);
    expect((await admin.auth.admin.deleteUser(shop.owner_id)).error).toBeNull();
  }
});
