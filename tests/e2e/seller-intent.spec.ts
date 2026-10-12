import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const password = "plaza-volcanes-intent-1";

test.beforeAll(() => {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(apiUrl)) {
    throw new Error("Seller intent tests create accounts. Use npm run test:e2e with local services only.");
  }
});

function accountEmail() {
  return `seller-intent-${crypto.randomUUID()}@test.local`;
}

async function register(page: Page, destination: string) {
  const email = accountEmail();
  await page.getByLabel("Tu nombre").fill("Intención Prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  return email;
}

async function expectSellerForm(page: Page) {
  await expect(page.getByRole("heading", { name: "Abre tu cuenta" })).toBeVisible();
  await expect(page.locator('input[name="intent"]')).toHaveValue("vender");
}

for (const query of ["vender=1", "intent=vender"]) {
  test(`direct seller signup accepts ${query}`, async ({ page }) => {
    await page.goto(`/registro?${query}`);
    await expectSellerForm(page);
    await register(page, "/panel/tiendas/nueva");
  });
}

for (const accountLink of ["Crear mi cuenta", "Saltar e ir al registro"]) {
  test(`seller guide preserves intent through back navigation and ${accountLink}`, async ({ page }) => {
    await page.goto("/registro?vender=1");
    await page.getByRole("link", { name: "Ver cómo funciona", exact: true }).click();
    await page.getByRole("link", { name: "Quiero vender", exact: true }).click();
    await page.getByRole("link", { name: "Volver", exact: true }).click();
    await page.getByRole("link", { name: "Saltar e ir al registro", exact: true }).click();
    await expectSellerForm(page);
    await page.getByRole("link", { name: "Ver cómo funciona", exact: true }).click();
    await page.getByRole("link", { name: "Quiero vender", exact: true }).click();
    await page.getByRole("link", { name: accountLink, exact: true }).click();
    await expectSellerForm(page);
    await register(page, "/panel/tiendas/nueva");
  });
}

test("seller choice starts intent for an ordinary visitor", async ({ page }) => {
  await page.goto("/registro");
  await page.getByRole("link", { name: "Quiero vender", exact: true }).click();
  await page.getByRole("link", { name: "Crear mi cuenta", exact: true }).click();
  await expectSellerForm(page);
  await register(page, "/panel/tiendas/nueva");
});

test("seller sign-in → signup → sign-in preserves destination", async ({ page, browser }) => {
  await page.goto("/registro?paso=formulario");
  const email = await register(page, "/panel");
  const other = await browser.newContext();
  try {
    const guest = await other.newPage();
    await guest.goto(new URL("/ingresar?intent=vender", page.url()).toString());
    await guest.getByRole("link", { name: "Regístrate", exact: true }).click();
    await expectSellerForm(guest);
    await guest.getByRole("link", { name: "Ingresa", exact: true }).click();
    await expect(guest).toHaveURL(/\/ingresar\?intent=vender$/);
    await expect(guest.getByRole("heading", { name: "Entra a tu plaza" })).toBeVisible();
    await expect(guest.locator('input[name="intent"]')).toHaveValue("vender");
    await guest.getByLabel("Correo electrónico").fill(email);
    await guest.getByLabel("Contraseña", { exact: true }).fill(password);
    await guest.getByRole("button", { name: "Ingresar", exact: true }).click();
    await expect(guest).toHaveURL(/\/panel\/tiendas\/nueva$/);
  } finally {
    await other.close();
  }
});

test("buyer guide and registration keep the default panel destination", async ({ page }) => {
  await page.goto("/registro");
  await page.getByRole("link", { name: "Quiero comprar", exact: true }).click();
  await page.getByRole("link", { name: "Crear mi cuenta", exact: true }).click();
  await expect(page.locator('input[name="intent"]')).toHaveCount(0);
  await register(page, "/panel");
});

test("validated continuation overrides seller signup", async ({ page }) => {
  await page.goto("/registro?vender=1&continuar=%2Fpanel%2Fcuenta");
  await page.getByRole("link", { name: "Ver cómo funciona", exact: true }).click();
  await page.getByRole("link", { name: "Quiero vender", exact: true }).click();
  await page.getByRole("link", { name: "Crear mi cuenta", exact: true }).click();
  await expect(page.locator('input[name="continuar"]')).toHaveValue("/panel/cuenta");
  await register(page, "/panel/cuenta");
});

test("unsafe continuation is dropped before seller signup", async ({ page }) => {
  await page.goto("/registro?intent=vender&continuar=%2F%252Fevil.example");
  await expect(page.locator('input[name="continuar"]')).toHaveCount(0);
  await expectSellerForm(page);
  await register(page, "/panel/tiendas/nueva");
});

test("real confirmation token opens store creation and persists seller session", async ({ page }) => {
  // Generate a real token on the local provider, without changing its
  // auto-confirm configuration or depending on outbound email delivery.
  const status = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  });
  const local = JSON.parse(status) as { API_URL: string; SERVICE_ROLE_KEY: string };
  expect(local.API_URL).toBe(apiUrl);
  const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup", email: accountEmail(), password,
  });
  expect(error).toBeNull();
  const tokenHash = data.properties?.hashed_token;
  expect(tokenHash).toBeTruthy();
  const params = new URLSearchParams({ type: "signup", intent: "vender", token_hash: tokenHash! });
  // Next's dev Route Handler uses localhost for the loopback request origin.
  // Keep callback and cookie hosts equal to test session persistence.
  const callback = new URL(`/auth/confirm?${params}`, test.info().project.use.baseURL);
  callback.hostname = "localhost";
  await page.goto(callback.toString());
  await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
  await page.reload();
  await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
});
