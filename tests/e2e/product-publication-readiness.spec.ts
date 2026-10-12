import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Fixture reads and administration changes stay on the local database. The
// seller's draft creation, saving, and publication all use real browser forms.
function localQuery(sql: string) {
  try {
    const raw = execFileSync("npx", ["supabase", "db", "query", "--local", "--output-format", "json", sql], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return raw.trim().startsWith("{") ? JSON.parse(raw).rows : [];
  } catch (error) {
    // CLI query failures put the useful database error on stdout.
    throw new Error(String((error as { stdout?: string }).stdout ?? error));
  }
}

for (const path of ["editor", "catalog"] as const) {
  test(`${path}: incomplete first product stays draft; complete product waits for approval`, async ({ page, browser }) => {
    test.setTimeout(120_000);
    if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(apiUrl)) {
      throw new Error("Use npm run test:e2e with local services only.");
    }
    const status = JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }));
    expect(status.API_URL).toBe(apiUrl);
    const admin = createClient(apiUrl, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const email = `publication-${path}-${crypto.randomUUID()}@test.local`;
    const productName = `Taza prueba ${path} ${crypto.randomUUID().slice(0, 8)}`;
    await page.goto("/registro?intent=vender");
    await page.getByLabel("Tu nombre").fill("Vendedor Prueba");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Teléfono móvil").fill("3312345678");
    await page.getByLabel("Contraseña", { exact: true }).fill("plaza-publication-test-1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
    const ownerId = localQuery(`select id from auth.users where email = '${email}'`)[0].id;
    let shopId: number | undefined;
    let imagePath: string | undefined;
    let reviewerId: string | undefined;
    const shopper = await browser.newContext();
    const publicPage = await shopper.newPage();
    try {
      await page.getByLabel("Nombre de la tienda").fill(`Casa Publicación ${path}`);
      await page.getByLabel("Descripción").fill("Objetos de barro hechos a mano en México.");
      await page.getByLabel("Estado principal").selectOption("MX-JAL");
      await page.getByRole("button", { name: "Crear tienda", exact: true }).click();
      await expect(page).toHaveURL(/\/panel\/tiendas\/\d+\?creada=1$/);
      shopId = Number(new URL(page.url()).pathname.split("/").at(-1));
      expect(Number.isSafeInteger(shopId) && shopId > 0).toBe(true);
      await page.getByRole("link", { name: "Agregar mi primer producto", exact: true }).click();
      await page.getByLabel("Nombre del producto").fill(productName);
      const category = localQuery("select c.id, c.parent_id from public.categories c join public.categories p on p.id = c.parent_id where c.is_active and p.is_active and c.listing_type = 'product' and p.listing_type = 'product' and p.parent_id is null order by c.id limit 1")[0];
      await page.getByLabel("Categoría", { exact: true }).selectOption(String(category.parent_id));
      await page.getByLabel("Subcategoría", { exact: true }).selectOption(String(category.id));
      await page.getByLabel("Nuevo", { exact: true }).check();
      await page.locator("#product-images").setInputFiles({
        name: "cover.png", mimeType: "image/png",
        buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGf8AAAAASUVORK5CYII=", "base64"),
      });
      await expect(page.locator('input[name="image_keys"]')).toHaveCount(1);
      await page.getByRole("button", { name: "Guardar producto", exact: true }).click();
      await expect(page).toHaveURL(/\/panel\/productos\/\d+\/editar\?creado=1$/);
      const productId = Number(new URL(page.url()).pathname.split("/").at(-2));
      expect(Number.isSafeInteger(productId) && productId > 0).toBe(true);
      const editorUrl = `/panel/productos/${productId}/editar`;
      const catalogUrl = `/panel/tiendas/${shopId}`;
      const readProduct = () => localQuery(`select name, description, price_mxn, condition, used_condition, handling_days, units_available, category_id, image_path, status, expires_at, slug, is_admin_enabled from public.products where id = ${productId}`)[0];
      const slotsUsed = () => Number(localQuery(`select count(*) as used from public.products where shop_id = ${shopId} and status = 'published'`)[0].used);
      const draft = readProduct();
      imagePath = draft.image_path;
      expect(draft).toMatchObject({ status: "draft", description: null, price_mxn: null, expires_at: null });
      expect(imagePath).toBeTruthy();
      expect(slotsUsed()).toBe(0);

      if (path === "catalog") {
        await page.goto(catalogUrl);
        await page.getByRole("button", { name: "Publicar", exact: true }).click();
        await expect(page.getByRole("status")).toContainText("Completa los requisitos antes de publicar.");
        await expect(page.getByRole("status")).toContainText("Describe tu producto en al menos 20 caracteres.");
        await expect(page.getByRole("status")).toContainText("Ponle precio en pesos.");
        await expect(page.getByRole("link", { name: "Completar producto" })).toHaveAttribute("href", editorUrl);
        await page.getByRole("link", { name: "Completar producto" }).click();
      } else {
        await page.getByRole("button", { name: "Publicar producto", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "Completa los requisitos antes de publicar." })).toBeVisible();
        await expect(page.getByLabel("Descripción", { exact: true })).toHaveAttribute("aria-invalid", "true");
        await expect(page.getByLabel("Precio en MXN")).toHaveAttribute("aria-invalid", "true");
      }
      expect(readProduct()).toEqual(draft);
      expect(slotsUsed()).toBe(0);
      await page.getByLabel("Descripción", { exact: true }).fill("Taza hecha a mano con barro de alta temperatura.");
      await page.getByLabel("Precio en MXN").fill("349");
      if (path === "catalog") {
        await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "Borrador guardado" })).toBeVisible();
        await page.goto(catalogUrl);
        await page.getByRole("button", { name: "Publicar", exact: true }).click();
      } else {
        await page.getByRole("button", { name: "Publicar producto", exact: true }).click();
      }
      await expect(page.getByRole("status").filter({ hasText: "Está pendiente de aprobación de administración." })).toBeVisible();
      expect(readProduct()).toMatchObject({ status: "published", expires_at: null, is_admin_enabled: true });
      expect(slotsUsed()).toBe(1);
      const publicUrl = `/productos/${readProduct().slug}`;
      await publicPage.goto(publicUrl);
      await expect(publicPage.getByRole("heading", { name: "No encontramos esta publicación", exact: true })).toBeVisible();
      await expect(publicPage.getByRole("heading", { name: productName, exact: true })).toHaveCount(0);

      // Approval's RPC also starts pending products' expiry windows. A direct
      // shop flag UPDATE would omit that behavior and cannot simulate approval.
      const reviewerEmail = `approval-${crypto.randomUUID()}@test.local`;
      const reviewerPassword = "plaza-approval-test-1";
      const createdReviewer = await admin.auth.admin.createUser({
        email: reviewerEmail, password: reviewerPassword, email_confirm: true,
      });
      expect(createdReviewer.error).toBeNull();
      reviewerId = createdReviewer.data.user!.id;
      localQuery(`insert into private.admin_users (user_id, granted_by) values ('${reviewerId}', '${reviewerId}')`);
      const reviewer = createClient(apiUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      expect((await reviewer.auth.signInWithPassword({ email: reviewerEmail, password: reviewerPassword })).error).toBeNull();
      expect((await reviewer.rpc("set_shop_publishing_approval", { p_shop_id: shopId, p_enabled: true })).error).toBeNull();
      expect(readProduct().expires_at).not.toBeNull();
      await publicPage.reload();
      await expect(publicPage.getByRole("heading", { name: productName, exact: true })).toBeVisible();
      expect((await reviewer.rpc("set_product_admin_enabled", { p_product_id: productId, p_enabled: false })).error).toBeNull();
      await publicPage.reload();
      await expect(publicPage.getByRole("heading", { name: "No encontramos esta publicación", exact: true })).toBeVisible();
      await expect(publicPage.getByRole("heading", { name: productName, exact: true })).toHaveCount(0);
    } finally {
      await shopper.close();
      if (imagePath) await admin.storage.from("catalogo").remove([imagePath]);
      if (shopId) {
        localQuery(`delete from public.seller_activity_events where shop_id = ${shopId}`);
        localQuery(`delete from public.shops where id = ${shopId}`);
      }
      expect((await admin.auth.admin.deleteUser(ownerId)).error).toBeNull();
      if (reviewerId) {
        localQuery(`delete from private.admin_users where user_id = '${reviewerId}'`);
        expect((await admin.auth.admin.deleteUser(reviewerId)).error).toBeNull();
      }
    }
  });
}
