import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// This spec registers accounts and creates shops and listings. `.env.local`
// points at the linked remote project, so `npm run test:e2e` routes through
// scripts/e2e-env.mjs, which forces the local stack. Running Playwright
// directly skips that, so the guard below refuses rather than trusting it.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

test.beforeAll(() => {
  if (!isLocal) {
    throw new Error(
      `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
        "These tests create real accounts, shops and listings. Use `npm run test:e2e`.",
    );
  }
});

function localQuery(sql: string) {
  try {
    const raw = execFileSync(
      "npx",
      ["supabase", "db", "query", "--local", "--output-format", "json", sql],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return raw.trim().startsWith("{") ? JSON.parse(raw).rows : [];
  } catch (error) {
    // CLI query failures put the useful database error on stdout.
    throw new Error(String((error as { stdout?: string }).stdout ?? error));
  }
}

/** Unique per worker process, not only per millisecond: specs start together. */
const stamp = `${Date.now()}-${process.pid}`;
const password = "plaza-volcanes-1";
const sellers = ["primera", "segunda"].map((which) => ({
  email: `slug-${which}-${stamp}@test.local`,
  name: `Vendedora ${which}`,
  shop: `Taller ${which} ${stamp}`,
}));
const emails = sellers.map((seller) => `'${seller.email}'`).join(", ");
// The same words in both shops, which is the whole point.
const productName = `Taza gemela ${stamp}`;
const plainSlug = `taza-gemela-${stamp}`;

async function openShop(page: Page, seller: (typeof sellers)[number]) {
  await page.goto("/registro?paso=formulario");
  await page.getByLabel("Tu nombre").fill(seller.name);
  await page.getByLabel("Correo electrónico").fill(seller.email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);

  await page.goto("/panel/tiendas/nueva");
  await page.getByLabel("Nombre de la tienda").fill(seller.shop);
  await page.getByLabel("Descripción").fill("Tienda de prueba para dos borradores con el mismo nombre.");
  await page.getByLabel("Estado principal").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Crear tienda", exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/tiendas\/\d+/);

  return Number(new URL(page.url()).pathname.split("/").at(-1));
}

async function saveDraft(page: Page, shopId: number) {
  await page.goto(`/panel/tiendas/${shopId}/productos/nuevo`);
  await page.getByLabel("Nombre del producto").fill(productName);
  await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
}

const slugs = () =>
  localQuery(
    `select p.slug from public.products p where p.name = '${productName}' order by p.id`,
  ).map((row: { slug: string }) => row.slug);

test.afterAll(() => {
  if (!isLocal) return;

  // Deleting an account takes its shop and its listings with it.
  localQuery(`delete from auth.users where email in (${emails})`);
});

test("two sellers can each keep a draft with the same name", async ({ browser }) => {
  test.setTimeout(120_000);

  const firstPage = await (await browser.newContext()).newPage();
  const secondPage = await (await browser.newContext()).newPage();
  const firstShop = await openShop(firstPage, sellers[0]);
  const secondShop = await openShop(secondPage, sellers[1]);

  await saveDraft(firstPage, firstShop);
  await expect(firstPage).toHaveURL(/\/panel\/productos\/\d+\/editar/);
  expect(slugs()).toEqual([plainSlug]);

  // The second seller cannot see the first one's draft, and it still holds the
  // slug. That used to end in "No pudimos crear el producto."
  await saveDraft(secondPage, secondShop);
  await expect(secondPage).toHaveURL(/\/panel\/productos\/\d+\/editar/);
  await expect(secondPage.getByRole("status").filter({ hasText: "Borrador guardado" })).toBeVisible();
  await expect(secondPage.getByText("No pudimos crear el producto.")).toHaveCount(0);

  const [first, second] = slugs();
  expect(first).toBe(plainSlug);
  expect(second).toMatch(new RegExp(`^${plainSlug}-[0-9a-f]{6}$`));

  // Saving either draft again leaves both where they are. The description is
  // what shows the save landed: the page already says "Borrador guardado".
  const description = "Taza de barro hecha a mano, apta para café.";
  for (const page of [firstPage, secondPage]) {
    await page.getByLabel("Descripción", { exact: true }).fill(description);
    await page.getByRole("button", { name: "Guardar borrador", exact: true }).click();
  }
  await expect
    .poll(
      () =>
        localQuery(
          `select count(*)::integer as saved from public.products
           where name = '${productName}' and description = '${description}'`,
        )[0].saved,
      { timeout: 20_000 },
    )
    .toBe(2);
  expect(slugs()).toEqual([first, second]);
});
