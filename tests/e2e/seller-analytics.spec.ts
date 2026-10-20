import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { pickOption } from "./pick-option";

function query(sql: string) {
  const raw = execFileSync("npx", ["supabase", "db", "query", "--local", "--output-format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return raw.trim().startsWith("{") ? JSON.parse(raw).rows : [];
}

test("a seller sees private product activity, filters and a usable mobile report", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const api = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(api)) throw new Error("Local services required");
  const status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  expect(status.API_URL).toBe(api);
  const admin = createClient(api, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `seller-analytics-${crypto.randomUUID()}@test.local`;
  const password = "plaza-analytics-local-test-1";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Vendedora Métricas", phone: "3312345678" } });
  expect(error).toBeNull();
  const owner = data.user!.id;
  const buyerContext = await browser.newContext();
  const buyer = await buyerContext.newPage();
  let shopId: number | undefined;
  try {
    const shop = query(`insert into public.shops(owner_id,name,slug,description) values('${owner}','Casa Métricas','analytics-${owner}','Objetos de barro y productos artesanales de México.') returning id`)[0];
    shopId = Number(shop.id);
    query(`update public.shops set is_publishing_approved=true where id=${shopId}`);
    const product = query(`insert into public.products(shop_id,name,slug,description,price_mxn,status,is_admin_enabled,image_path,category_id) values(${shopId},'Taza de métricas','taza-${owner}','Taza artesanal para probar las estadísticas del producto.',120,'published',true,'tests/cover.webp',(select id from public.categories where slug='celulares-y-accesorios')) returning id,slug`)[0];
    const productId = Number(product.id);
    await buyer.goto(`/productos/${product.slug}`);
    await expect.poll(() => query(`select tracked_views from private.product_view_days where product_id=${productId}`)[0]?.tracked_views).toBe(1);
    await buyer.getByRole("link", { name: "Preguntar por este producto" }).click();
    await expect(buyer).toHaveURL(/\/ingresar/);
    await expect.poll(() => query(`select question_clicks from private.product_view_days where product_id=${productId}`)[0]?.question_clicks).toBe(1);
    await buyer.goto(`/productos/${product.slug}`);
    await buyer.getByRole("button", { name: "Compartir", exact: true }).click();
    await expect.poll(() => query(`select share_clicks from private.product_view_days where product_id=${productId}`)[0]?.share_clicks).toBe(1);
    await buyer.getByRole("button", { name: "Solicitar compra", exact: true }).click();
    await expect.poll(() => query(`select purchase_clicks from private.product_view_days where product_id=${productId}`)[0]?.purchase_clicks).toBe(1);
    expect(query(`select views,interests from private.product_view_days where product_id=${productId}`)[0]).toMatchObject({ views: 1, interests: 1 });

    await page.goto("/ingresar?continuar=/panel/estadisticas");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(page).toHaveURL(/\/panel\/estadisticas$/);
    await expect(page.getByRole("heading", { level: 1, name: "Estadísticas" })).toBeVisible();
    const row = page.getByRole("table", { name: "Actividad por producto" }).getByRole("row").filter({ hasText: "Taza de métricas" });
    await expect(row).toContainText("100%");
    await expect(row.getByRole("cell")).toHaveText(["1", "1", "1", "1", "0", "0", "100%"]);
    await pickOption(page.getByRole("combobox", { name: "Periodo" }), "7");
    await pickOption(page.getByRole("combobox", { name: "Tienda" }), String(shopId));
    await page.getByRole("button", { name: "Aplicar" }).click();
    await expect(page).toHaveURL(new RegExp(`tienda=${shopId}.*dias=7`));
    await expect(page.getByRole("combobox", { name: "Periodo" })).toHaveValue("7");
    const anonymous = createClient(api, status.PUBLISHABLE_KEY, { auth: { persistSession: false } });
    const replayId = crypto.randomUUID();
    const results = await Promise.all(Array.from({ length: 5 }, () => anonymous.rpc("record_product_activity", {
      p_product_id: productId, p_action: "question", p_session_id: replayId,
    })));
    for (const result of results) expect(result.error).toBeNull();
    expect(query(`select views,question_clicks,interests from private.product_view_days where product_id=${productId}`)[0])
      .toMatchObject({ views: 2, question_clicks: 2, interests: 2 });
    await page.screenshot({ path: "output/playwright/seller-analytics-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "output/playwright/seller-analytics-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/panel/estadisticas?tienda=2147483647");
    await expect(page.getByRole("heading", { name: "Estadísticas", exact: true })).toHaveCount(0);
  } finally {
    await buyerContext.close();
    if (shopId) query(`delete from public.shops where id=${shopId}`);
    await admin.auth.admin.deleteUser(owner);
  }
});
