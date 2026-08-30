import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

// Like the messaging spec, this one registers accounts and publishes a product,
// so it must never reach the linked remote project. `npm run test:e2e` forces
// the local stack; running Playwright bare skips that, and the guard refuses.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

test.beforeAll(() => {
  if (!isLocal) {
    throw new Error(
      `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
        "These tests create real accounts and products. Use `npm run test:e2e`.",
    );
  }
});

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

function approveShopForPublication(slug: string) {
  execFileSync(
    "npx",
    [
      "supabase",
      "db",
      "query",
      "--local",
      `do $$ begin
        update public.shops set is_publishing_approved = true where slug = '${slug}';
        if not found then raise exception 'Could not approve local e2e shop.'; end if;
      end $$;`,
    ],
    { stdio: "pipe" },
  );
}

test("a signed-out shopper keeps their purchase through sign-in", async ({ browser }) => {
  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();

  await register(sellerPage, seller);

  await sellerPage.goto("/panel/tiendas/nueva");
  await sellerPage.getByLabel("Nombre de la tienda").fill(`Tienda ${stamp}`);
  await sellerPage
    .getByLabel("Descripción")
    .fill("Tienda de prueba para verificar la compra de un visitante.");
  await sellerPage.getByLabel("Estado principal").selectOption({ index: 1 });
  await sellerPage.getByRole("button", { name: "Crear tienda" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/tiendas\/\d+/);

  approveShopForPublication(`tienda-${stamp}`);

  const shopHref = await sellerPage
    .getByRole("link", { name: /ver tienda|tienda pública/i })
    .first()
    .getAttribute("href");

  // A published product for the visitor to want.
  const productName = `Taza de barro ${stamp}`;
  await sellerPage.getByRole("link", { name: /nuevo producto|agregar producto/i }).first().click();
  await expect(sellerPage).toHaveURL(/\/productos\/nuevo/);
  await sellerPage.getByLabel("Categoría", { exact: true }).selectOption({ index: 1 });
  await sellerPage.getByLabel("Subcategoría").selectOption({ index: 1 });
  await sellerPage.getByLabel("Nombre del producto").fill(productName);
  await sellerPage.getByLabel("Descripción").fill("Pieza de prueba para la compra de un visitante.");
  await sellerPage.getByLabel("Precio en MXN").fill("250");
  await sellerPage.getByLabel("Unidades disponibles").fill("5");
  await sellerPage.getByRole("button", { name: "Guardar producto" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/productos\/\d+\/editar/);
  await sellerPage.getByRole("button", { name: "Publicar producto" }).click();
  await expect(sellerPage.getByRole("status")).toHaveText("Producto publicado.");

  // The buyer's account exists, but the browser doing the buying is a stranger.
  const registrationContext = await browser.newContext();
  await register(await registrationContext.newPage(), buyer);
  await registrationContext.close();

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();

  await guestPage.goto(shopHref ?? "/");
  await guestPage.getByRole("link", { name: productName }).first().click();
  await expect(guestPage).toHaveURL(/\/productos\//);
  const productUrl = guestPage.url();

  await guestPage.getByLabel(/Cantidad/).fill("2");
  await guestPage.getByRole("button", { name: "Solicitar compra" }).click();

  // The wall, explained as an invitation rather than as a lost session.
  await expect(guestPage).toHaveURL(/\/ingresar/);
  await expect(guestPage.getByRole("status")).toHaveText(
    "Ingresa o crea tu cuenta para continuar tu compra.",
  );
  await expect(guestPage.getByText(/sesión terminó/)).toHaveCount(0);

  await guestPage.getByLabel("Correo electrónico").fill(buyer.email);
  await guestPage.getByLabel("Contraseña").fill(buyer.password);
  await guestPage.getByRole("button", { name: "Ingresar" }).click();

  // The purchase finishes itself: the cart is that shop's, and it holds what
  // the visitor chose before they had an account.
  await expect(guestPage).toHaveURL(/\/carrito\/\d+/);
  await expect(guestPage.getByRole("heading", { name: new RegExp(`Tienda ${stamp}`) })).toBeVisible();
  await expect(guestPage.getByText(productName)).toBeVisible();
  await expect(guestPage.getByLabel(`Cantidad de ${productName}`)).toHaveValue("2");

  // This is a real RSC boundary: the cart must serialize the imported/bound
  // start action, create nothing during render, then return here after the
  // explicit click with an imported/bound send action for the new thread.
  await expect(guestPage.getByLabel("Mensaje", { exact: true })).toHaveCount(0);
  const cartUrl = guestPage.url();
  await guestPage.getByRole("button", { name: "Preguntar sobre este producto" }).click();
  await expect(guestPage).toHaveURL(cartUrl);
  await expect(guestPage.getByLabel("Mensaje", { exact: true })).toBeVisible();

  // Re-opening the destination must not add the product a second time.
  await guestPage.goto(cartUrl);
  await expect(guestPage.getByLabel(`Cantidad de ${productName}`)).toHaveValue("2");

  // And an ordinary sign-in with nothing pending still lands on the panel.
  const plainContext = await browser.newContext();
  const plainPage = await plainContext.newPage();
  await plainPage.goto("/ingresar");
  await plainPage.getByLabel("Correo electrónico").fill(buyer.email);
  await plainPage.getByLabel("Contraseña").fill(buyer.password);
  await plainPage.getByRole("button", { name: "Ingresar" }).click();
  await expect(plainPage).toHaveURL(/\/panel/);

  expect(productUrl).toContain("/productos/");
});

test("a buyer must choose how they receive the item", async ({ browser }) => {
  const stamp2 = Date.now() * 10 + 2;
  const seller2 = {
    email: `seller2-${stamp2}@test.local`,
    password: "plaza-volcanes-1",
    name: "Vendedor Dos",
  };
  const buyer2 = {
    email: `buyer2-${stamp2}@test.local`,
    password: "plaza-volcanes-1",
    name: "Bea Lopez",
  };

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await register(sellerPage, seller2);

  await sellerPage.goto("/panel/tiendas/nueva");
  await sellerPage.getByLabel("Nombre de la tienda").fill(`Tienda ${stamp2}`);
  await sellerPage
    .getByLabel("Descripción")
    .fill("Descripción completa de la tienda de prueba para recolección.");
  await sellerPage.getByLabel("Estado principal").selectOption("MX-JAL");
  await sellerPage.getByLabel("Ofrezco recolección en tienda").check();
  await sellerPage.getByLabel("Calle y número de recolección").fill("Av. Vallarta 1234");
  await sellerPage.getByLabel("Ciudad de recolección").fill("Zapopan");
  await sellerPage.getByLabel("Estado de recolección").selectOption("MX-JAL");
  await sellerPage.getByLabel("Código postal de recolección").fill("45010");
  await sellerPage.getByRole("button", { name: "Crear tienda" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/tiendas\//);

  approveShopForPublication(`tienda-${stamp2}`);

  // A published product for the visitor to want.
  const productName = `Taza de barro ${stamp2}`;
  await sellerPage.getByRole("link", { name: /nuevo producto|agregar producto/i }).first().click();
  await expect(sellerPage).toHaveURL(/\/productos\/nuevo/);
  await sellerPage.getByLabel("Categoría", { exact: true }).selectOption({ index: 1 });
  await sellerPage.getByLabel("Subcategoría").selectOption({ index: 1 });
  await sellerPage.getByLabel("Nombre del producto").fill(productName);
  await sellerPage.getByLabel("Descripción").fill("Pieza de prueba para la compra de un visitante.");
  await sellerPage.getByLabel("Precio en MXN").fill("250");
  await sellerPage.getByLabel("Unidades disponibles").fill("5");
  await sellerPage.getByRole("button", { name: "Guardar producto" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/productos\/\d+\/editar/);
  await sellerPage.getByRole("button", { name: "Publicar producto" }).click();
  await expect(sellerPage.getByRole("status")).toHaveText("Producto publicado.");

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await register(buyerPage, buyer2);

  await buyerPage.goto(`/tiendas/tienda-${stamp2}`);
  await buyerPage.getByRole("link", { name: /Taza/ }).click();
  await buyerPage.getByRole("button", { name: "Solicitar compra" }).click();
  await expect(buyerPage).toHaveURL(/\/carrito\//);

  // Neither option chosen: the request cannot be sent.
  await expect(buyerPage.getByRole("button", { name: "Confirmar solicitud" })).toBeDisabled();
  await expect(buyerPage.getByText("Elige una opción para continuar.")).toBeVisible();

  // Pickup shows the city and withholds the street.
  await buyerPage.getByLabel("Recolección en tienda").check();
  await expect(buyerPage.getByText("Zapopan, Jalisco", { exact: true })).toBeVisible();
  await expect(buyerPage.getByText("Av. Vallarta 1234")).toHaveCount(0);
  await expect(buyerPage.getByRole("button", { name: "Confirmar solicitud" })).toBeEnabled();

  await buyerPage.getByRole("button", { name: "Confirmar solicitud" }).click();
  await expect(buyerPage).toHaveURL(/\/compras\/\d+/);

  // Still pending, so still no street.
  await expect(buyerPage.getByText("Solicitud enviada", { exact: true })).toBeVisible();
  await expect(buyerPage.getByText("Recolección en tienda")).toBeVisible();
  await expect(buyerPage.getByText("Av. Vallarta 1234")).toHaveCount(0);

  await sellerContext.close();
  await buyerContext.close();
});

test("choosing shipping asks for an address and creates a shipped order", async ({ browser }) => {
  const stamp3 = Date.now() * 10 + 3;
  const seller3 = {
    email: `seller3-${stamp3}@test.local`,
    password: "plaza-volcanes-1",
    name: "Vendedor Tres",
  };
  const buyer3 = {
    email: `buyer3-${stamp3}@test.local`,
    password: "plaza-volcanes-1",
    name: "Cris Mora",
  };

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await register(sellerPage, seller3);

  await sellerPage.goto("/panel/tiendas/nueva");
  await sellerPage.getByLabel("Nombre de la tienda").fill(`Tienda ${stamp3}`);
  await sellerPage
    .getByLabel("Descripción")
    .fill("Descripción completa de la tienda de prueba para envío.");
  await sellerPage.getByLabel("Estado principal").selectOption("MX-JAL");
  await sellerPage.getByRole("button", { name: "Crear tienda" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/tiendas\//);

  approveShopForPublication(`tienda-${stamp3}`);

  // A published product for the visitor to want.
  const productName = `Taza de barro ${stamp3}`;
  await sellerPage.getByRole("link", { name: /nuevo producto|agregar producto/i }).first().click();
  await expect(sellerPage).toHaveURL(/\/productos\/nuevo/);
  await sellerPage.getByLabel("Categoría", { exact: true }).selectOption({ index: 1 });
  await sellerPage.getByLabel("Subcategoría").selectOption({ index: 1 });
  await sellerPage.getByLabel("Nombre del producto").fill(productName);
  await sellerPage.getByLabel("Descripción").fill("Pieza de prueba para la compra de un visitante.");
  await sellerPage.getByLabel("Precio en MXN").fill("250");
  await sellerPage.getByLabel("Unidades disponibles").fill("5");
  await sellerPage.getByRole("button", { name: "Guardar producto" }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/productos\/\d+\/editar/);
  await sellerPage.getByRole("button", { name: "Publicar producto" }).click();
  await expect(sellerPage.getByRole("status")).toHaveText("Producto publicado.");

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await register(buyerPage, buyer3);

  await buyerPage.goto(`/tiendas/tienda-${stamp3}`);
  await buyerPage.getByRole("link", { name: /Taza/ }).click();
  await buyerPage.getByRole("button", { name: "Solicitar compra" }).click();
  await expect(buyerPage).toHaveURL(/\/carrito\//);

  await buyerPage.getByLabel("Envío a domicilio").check();
  await buyerPage.getByLabel("Nombre de quien recibe").fill("Cris Mora");
  await buyerPage.getByLabel("Calle y número").fill("Calle Falsa 123");
  await buyerPage.getByLabel("Ciudad o localidad").fill("Guadalajara");
  await buyerPage.getByLabel("Estado").fill("Jalisco");
  await buyerPage.getByLabel("Código postal").fill("44100");

  await buyerPage.getByRole("button", { name: "Confirmar solicitud" }).click();
  await expect(buyerPage).toHaveURL(/\/compras\/\d+/);

  await expect(buyerPage.getByText("Envío a domicilio")).toBeVisible();
  await expect(buyerPage.getByText("Calle Falsa 123")).toBeVisible();

  await sellerContext.close();
  await buyerContext.close();
});
