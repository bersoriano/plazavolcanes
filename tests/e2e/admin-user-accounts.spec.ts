import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// This spec registers accounts, disables one and deletes it. `.env.local`
// points at the linked remote project, so `npm run test:e2e` routes through
// scripts/e2e-env.mjs, which forces the local stack. Running Playwright
// directly skips that, so the guard below refuses rather than trusting it.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

test.beforeAll(() => {
  if (!isLocal) {
    throw new Error(
      `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
        "These tests create and delete real accounts. Use `npm run test:e2e`.",
    );
  }
});

// Administrator membership has no application surface, so it is granted the
// way an operator would. Everything the spec asserts goes through the browser.
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

/** Each run needs its own accounts, because e-mail addresses are unique. */
const stamp = Date.now();
const password = "plaza-volcanes-1";
const admin = { email: `admin-accounts-${stamp}@test.local`, name: `Administración ${stamp}` };
const member = { email: `member-accounts-${stamp}@test.local`, name: `Persona ${stamp}` };

async function register(page: Page, account: { email: string; name: string }) {
  await page.goto("/registro?paso=formulario");
  await page.getByLabel("Tu nombre").fill(account.name);
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

async function signIn(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
}

test.afterAll(() => {
  if (!isLocal) return;

  // Other suites assert on the full account list, so this one leaves none behind.
  const emails = `('${admin.email}', '${member.email}')`;
  localQuery(
    `delete from private.admin_users where user_id in (select id from auth.users where email in ${emails})`,
  );
  localQuery(`delete from auth.users where email in ${emails}`);
});

test("an administrator disables, re-enables and deletes an account", async ({ browser }) => {
  test.setTimeout(120_000);

  const adminPage = await (await browser.newContext()).newPage();
  const memberPage = await (await browser.newContext()).newPage();

  await register(memberPage, member);
  await register(adminPage, admin);
  localQuery(
    `insert into private.admin_users (user_id, granted_by)
     select id, id from auth.users where email = '${admin.email}'`,
  );

  await adminPage.goto("/admin/usuarios");
  const memberCard = adminPage.locator("article").filter({ hasText: member.email });
  const adminCard = adminPage.locator("article").filter({ hasText: admin.email });

  // An administrator account, the viewer's own included, offers no account actions.
  await expect(adminCard.getByText("Cuenta de administración")).toBeVisible();
  await expect(adminCard.getByRole("button", { name: /cuenta de/ })).toHaveCount(0);

  await memberCard.getByRole("button", { name: `Deshabilitar cuenta de ${member.name}` }).click();
  await expect(memberCard.getByText("Cuenta deshabilitada")).toBeVisible();

  // The disabled person is told why, instead of being told the password is wrong.
  const returningPage = await (await browser.newContext()).newPage();
  await signIn(returningPage, member.email);
  await expect(
    returningPage.getByText("Tu cuenta fue deshabilitada por administración."),
  ).toBeVisible();
  await expect(returningPage).toHaveURL(/\/ingresar/);

  await memberCard.getByRole("button", { name: `Habilitar cuenta de ${member.name}` }).click();
  await expect(memberCard.getByText("Cuenta deshabilitada")).toHaveCount(0);

  await signIn(returningPage, member.email);
  await expect(returningPage).toHaveURL(/\/panel/);

  await memberCard.getByRole("button", { name: `Eliminar cuenta de ${member.name}` }).click();
  const confirm = memberCard.getByRole("button", { name: "Eliminar definitivamente" });
  await expect(confirm).toBeDisabled();
  await memberCard.getByLabel(`Escribe ${member.email} para confirmar`).fill(member.email);
  await confirm.click();

  await expect(memberCard).toHaveCount(0);
  expect(
    localQuery(`select count(*)::integer as n from auth.users where email = '${member.email}'`)[0].n,
  ).toBe(0);

  await signIn(returningPage, member.email);
  await expect(returningPage.getByText("Correo o contraseña incorrectos.")).toBeVisible();
});
