import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { pickOption } from "./pick-option";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

test.beforeAll(() => {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl)) {
    throw new Error("These tests create real accounts and shops. Use npm run test:e2e with local Supabase.");
  }
});

async function register(page: Page) {
  const email = `shop-reset-${randomUUID()}@test.local`;
  await page.goto("/registro?paso=formulario");
  await page.getByLabel("Tu nombre").fill("Vendedor Prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña").fill("plaza-volcanes-1");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
  return email;
}

// Read only the local database. A rejected create must leave zero rows, and
// correcting it must create exactly one shop with its requested pickup point.
function savedShops(email: string) {
  const result = execFileSync("npx", [
    "supabase", "db", "query", "--local", "--output-format", "json",
    `select s.name, s.description, s.administrative_area_codes,
      p.address_line1, p.locality, p.administrative_area_code, p.postal_code, p.notes
      from public.shops s left join public.shop_pickup_points p on p.shop_id = s.id
      where s.owner_id = (select id from auth.users where email = '${email.replaceAll("'", "''")}')`,
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(result).rows;
}

async function fillShop(page: Page) {
  await page.getByLabel("Nombre de la tienda").fill("Casa Niebla");
  await page.getByLabel("Descripción").fill("Objetos de barro hechos a mano en México.");
  await pickOption(page.getByLabel("Estado principal"), "MX-CMX");
  await pickOption(page.getByLabel("Segundo estado (opcional)"), "MX-MEX");
  await page.getByLabel("Ofrezco recolección en tienda").check();
}

async function expectChoices(page: Page) {
  await expect(page.getByLabel("Estado principal")).toHaveValue("MX-CMX");
  await expect(page.getByLabel("Segundo estado (opcional)")).toHaveValue("MX-MEX");
  await expect(page.getByLabel("Ofrezco recolección en tienda")).toBeChecked();
  await expect(page.getByLabel("Calle y número de recolección")).toBeVisible();
}

async function fillPickup(page: Page, postalCode: string) {
  await page.getByLabel("Calle y número de recolección").fill("Calle Niebla 12");
  await page.getByLabel("Ciudad de recolección").fill("Coyoacán");
  await pickOption(page.getByLabel("Estado de recolección"), "MX-CMX");
  await page.getByLabel("Código postal de recolección").fill(postalCode);
  await page.getByLabel("Referencias para llegar").fill("Portón verde");
}

async function expectPickup(page: Page, postalCode: string) {
  await expect(page.getByLabel("Calle y número de recolección")).toHaveValue("Calle Niebla 12");
  await expect(page.getByLabel("Ciudad de recolección")).toHaveValue("Coyoacán");
  await expect(page.getByLabel("Estado de recolección")).toHaveValue("MX-CMX");
  await expect(page.getByLabel("Código postal de recolección")).toHaveValue(postalCode);
  await expect(page.getByLabel("Referencias para llegar")).toHaveValue("Portón verde");
}

async function submitError(page: Page, button: string, message: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: message })).toBeVisible();
  // Wait for the action transition and React's reset to finish, including
  // repeated submissions that return the same validation message.
  await expect(page.getByRole("button", { name: button, exact: true })).toBeEnabled();
}

test("create and edit retain choices through real validation, reset, correction and pickup removal", async ({ page }) => {
  test.setTimeout(90_000);
  const email = await register(page);
  await page.goto("/panel/tiendas/nueva");
  await fillShop(page);
  await page.getByLabel(/Política de entregas/).fill("Entrego los sábados.");

  // Exact production reproduction: empty required pickup details.
  await submitError(page, "Crear tienda", "Revisa los datos de recolección.");
  await expectChoices(page);
  await expect(page.getByLabel("Nombre de la tienda")).toHaveValue("Casa Niebla");
  await expect(page.getByLabel("Descripción")).toHaveValue("Objetos de barro hechos a mano en México.");
  await expect(page.getByLabel(/Política de entregas/)).toHaveValue("Entrego los sábados.");
  expect(savedShops(email)).toEqual([]);

  await fillPickup(page, "12");
  await submitError(page, "Crear tienda", "Revisa los datos de recolección.");
  await expectChoices(page);
  await expectPickup(page, "12");
  expect(savedShops(email)).toEqual([]);

  await page.getByLabel("Nombre de la tienda").fill("X");
  await page.getByLabel("Descripción").fill("Corta");
  await submitError(page, "Crear tienda", "Revisa los campos marcados.");
  await expectChoices(page);
  await expectPickup(page, "12");
  await expect(page.getByLabel("Nombre de la tienda")).toHaveValue("X");
  await expect(page.getByLabel("Descripción")).toHaveValue("Corta");
  expect(savedShops(email)).toEqual([]);

  await page.getByLabel("Nombre de la tienda").fill("Casa Niebla");
  await page.getByLabel("Descripción").fill("Objetos de barro hechos a mano en México.");
  await page.getByLabel("Código postal de recolección").fill("04100");
  await page.getByRole("button", { name: "Crear tienda", exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/tiendas\/\d+\?creada=1/);
  const settingsUrl = `${new URL(page.url()).pathname}/ajustes`;
  expect(savedShops(email)).toEqual([expect.objectContaining({
    name: "Casa Niebla", administrative_area_codes: ["MX-CMX", "MX-MEX"],
    address_line1: "Calle Niebla 12", locality: "Coyoacán", postal_code: "04100", notes: "Portón verde",
  })]);

  await page.goto(settingsUrl);
  // Change away from persisted defaults, so an edit reset cannot hide the bug.
  await pickOption(page.getByLabel("Estado principal"), "MX-JAL");
  await pickOption(page.getByLabel("Segundo estado (opcional)"), "MX-OAX");
  await page.getByLabel("Nombre de la tienda").fill("X");
  await submitError(page, "Guardar cambios", "Revisa los campos marcados.");
  await expect(page.getByLabel("Estado principal")).toHaveValue("MX-JAL");
  await expect(page.getByLabel("Segundo estado (opcional)")).toHaveValue("MX-OAX");
  await expect(page.getByLabel("Ofrezco recolección en tienda")).toBeChecked();
  await expectPickup(page, "04100");
  expect(savedShops(email)[0].name).toBe("Casa Niebla");

  await page.getByLabel("Nombre de la tienda").fill("Casa Niebla editada");
  await page.getByLabel("Código postal de recolección").fill("34");
  await submitError(page, "Guardar cambios", "Revisa los datos de recolección.");
  await expect(page.getByLabel("Estado principal")).toHaveValue("MX-JAL");
  await expect(page.getByLabel("Segundo estado (opcional)")).toHaveValue("MX-OAX");
  await expect(page.getByLabel("Ofrezco recolección en tienda")).toBeChecked();
  await expectPickup(page, "34");
  expect(savedShops(email)[0].postal_code).toBe("04100");

  await page.getByLabel("Código postal de recolección").fill("04200");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tienda actualizada." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Nombre de la tienda")).toHaveValue("Casa Niebla editada");
  await expectPickup(page, "04200");

  await page.getByLabel("Código postal de recolección").fill("56");
  await submitError(page, "Guardar cambios", "Revisa los datos de recolección.");
  await page.getByLabel("Ofrezco recolección en tienda").uncheck();
  await expect(page.getByLabel("Calle y número de recolección")).toHaveCount(0);
  const secondary = page.getByLabel("Segundo estado (opcional)");
  await expect(secondary.locator('option[value="MX-JAL"]')).toHaveCount(0);
  await pickOption(page.getByLabel("Estado principal"), "MX-OAX");
  await expect(secondary).toHaveValue("");
  await page.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tienda actualizada." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Ofrezco recolección en tienda")).not.toBeChecked();
  await expect(page.getByLabel("Calle y número de recolección")).toHaveCount(0);
  expect(savedShops(email)).toEqual([expect.objectContaining({
    administrative_area_codes: ["MX-OAX"], address_line1: null,
  })]);
});

test("creation can disable pickup after rejection and clears a duplicate secondary state", async ({ page }) => {
  const email = await register(page);
  await page.goto("/panel/tiendas/nueva");
  await fillShop(page);
  await submitError(page, "Crear tienda", "Revisa los datos de recolección.");
  await page.getByLabel("Ofrezco recolección en tienda").uncheck();
  await expect(page.getByLabel("Calle y número de recolección")).toHaveCount(0);
  const secondary = page.getByLabel("Segundo estado (opcional)");
  await expect(secondary.locator('option[value="MX-CMX"]')).toHaveCount(0);
  await pickOption(page.getByLabel("Estado principal"), "MX-MEX");
  await expect(secondary).toHaveValue("");
  await page.getByRole("button", { name: "Crear tienda", exact: true }).click();
  await expect(page).toHaveURL(/\/panel\/tiendas\/\d+\?creada=1/);
  expect(savedShops(email)).toEqual([expect.objectContaining({
    administrative_area_codes: ["MX-MEX"], address_line1: null,
  })]);
});
