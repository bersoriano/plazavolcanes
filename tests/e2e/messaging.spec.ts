import { expect, test, type Page } from "@playwright/test";

// This spec registers accounts, creates a shop and sends messages. `.env.local`
// points at the linked remote project, so `npm run test:e2e` routes through
// scripts/e2e-env.mjs, which forces the local stack. Running Playwright
// directly skips that, so the guard below refuses rather than trusting it.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

test.beforeAll(() => {
  if (!isLocal) {
    throw new Error(
      `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
        "These tests create real accounts and shops. Use `npm run test:e2e`.",
    );
  }
});

/** Each run needs its own accounts, because e-mail addresses are unique. */
const stamp = Date.now();
const seller = { email: `seller-${stamp}@test.local`, password: "plaza-volcanes-1", name: "Vendedor Prueba" };
const buyer = { email: `buyer-${stamp}@test.local`, password: "plaza-volcanes-1", name: "Ana Ruiz" };

async function register(page: Page, account: { email: string; password: string; name: string }) {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill(account.name);
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña").fill(account.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test("a shopper asks a question and the shop answers", async ({ browser }) => {
  const sellerContext = await browser.newContext();
  const buyerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  const buyerPage = await buyerContext.newPage();

  await register(sellerPage, seller);

  // The shop the buyer will write to.
  await sellerPage.goto("/panel/tiendas/nueva");
  await sellerPage.getByLabel("Nombre de la tienda").fill(`Tienda ${stamp}`);
  await sellerPage
    .getByLabel("Descripción")
    .fill("Tienda de prueba para verificar la mensajería de la plaza.");
  await sellerPage.getByLabel("Estado principal").selectOption({ index: 1 });
  await sellerPage.getByRole("button", { name: "Crear tienda" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/tiendas\/\d+/);

  const shopSlug = await sellerPage
    .getByRole("link", { name: /ver tienda|tienda pública/i })
    .first()
    .getAttribute("href");

  await register(buyerPage, buyer);

  // The buyer opens the shop and starts a conversation.
  await buyerPage.goto(shopSlug ?? "/");
  await buyerPage.getByRole("button", { name: "Mensaje a la tienda" }).click();
  await expect(buyerPage).toHaveURL(/\/mensajes\/\d+/);

  await buyerPage.getByLabel("Mensaje", { exact: true }).fill("¿Tienes talla 8?");
  await buyerPage.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(buyerPage.getByText("¿Tienes talla 8?")).toBeVisible();

  // The seller sees it waiting, under the name the buyer chose.
  await sellerPage.goto("/panel/mensajes");
  await expect(sellerPage.getByLabel(/mensajes sin leer/i).first()).toBeVisible();
  await sellerPage.getByRole("link", { name: new RegExp(buyer.name, "i") }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/mensajes\/\d+/);

  await sellerPage.getByLabel("Mensaje", { exact: true }).fill("Sí, tenemos");
  await sellerPage.getByRole("button", { name: "Enviar mensaje" }).click();

  // The buyer's thread is still open, so the answer arrives without a reload.
  await expect(buyerPage.getByText("Sí, tenemos")).toBeVisible({ timeout: 15_000 });

  // Opening the thread cleared the seller's badge.
  await sellerPage.goto("/panel/mensajes");
  await expect(sellerPage.getByLabel(/mensajes sin leer/i)).toHaveCount(0);
});
