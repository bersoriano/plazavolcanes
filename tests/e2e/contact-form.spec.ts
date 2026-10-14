import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// This spec registers accounts and stores messages. `.env.local` points at the
// linked remote project, so `npm run test:e2e` routes through
// scripts/e2e-env.mjs, which forces the local stack. Running Playwright
// directly skips that, so the guard below refuses rather than trusting it.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

test.beforeAll(() => {
  if (!isLocal) {
    throw new Error(
      `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
        "These tests create real accounts and store messages. Use `npm run test:e2e`.",
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

const stamp = `${Date.now()}-${process.pid}`;
const password = "plaza-volcanes-1";
const admin = { email: `admin-contact-${stamp}@test.local`, name: `Administración ${stamp}` };
const member = { email: `member-contact-${stamp}@test.local`, name: `Persona ${stamp}` };
const visitor = { email: `visitor-contact-${stamp}@test.local`, name: `Visitante ${stamp}` };
const emails = `('${admin.email}', '${member.email}', '${visitor.email}')`;

async function register(page: Page, account: { email: string; name: string }) {
  await page.goto("/registro?paso=formulario");
  await page.getByLabel("Tu nombre").fill(account.name);
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe("writing to the plaza", () => {
  test.beforeAll(() => {
    if (!isLocal) return;
    // Every signed-out sender shares one hourly limit; earlier runs must not spend it.
    localQuery(`delete from private.contact_rate_limits where sender = 'anon'`);
  });

  // Scoped to this group, so only the worker that created the accounts removes them.
  test.afterAll(() => {
    if (!isLocal) return;

    // Other suites assert on whole tables, so this one leaves nothing behind.
    localQuery(`delete from private.contact_messages where email in ${emails}`);
    localQuery(
      `delete from private.admin_users where user_id in (select id from auth.users where email in ${emails})`,
    );
    localQuery(`delete from auth.users where email in ${emails}`);
  });

  test("a visitor and a signed-in person write, and administration attends", async ({ browser }) => {
    test.setTimeout(120_000);

    // A visitor without an account leaves how to answer them.
    const visitorPage = await (await browser.newContext()).newPage();
    await visitorPage.goto("/quejas-y-aclaraciones");
    const visitorForm = visitorPage.getByRole("region", { name: "Escríbenos" });
    await visitorForm.getByLabel("Nombre").fill(visitor.name);
    await visitorForm.getByLabel("Correo electrónico").fill(visitor.email);
    await visitorForm.getByLabel("Teléfono móvil").fill("55 8765 4321");
    await visitorForm.getByLabel("Mensaje", { exact: true }).fill(`No llegó mi pedido ${stamp}.`);
    await visitorForm.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(visitorForm.getByRole("status")).toHaveText(
      "Recibimos tu mensaje. Te responderemos por correo o teléfono.",
    );

    // A signed-in person writes only the message.
    const memberPage = await (await browser.newContext()).newPage();
    await register(memberPage, member);
    await memberPage.goto("/quejas-y-aclaraciones");
    const memberForm = memberPage.getByRole("region", { name: "Escríbenos" });
    await expect(memberForm.getByLabel("Correo electrónico")).toHaveCount(0);
    await memberForm.getByLabel("Mensaje", { exact: true }).fill(`El vendedor no responde ${stamp}.`);
    await memberForm.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(memberForm.getByRole("status")).toContainText("Recibimos tu mensaje.");

    // Administration reads both, with how to answer each.
    const adminPage = await (await browser.newContext()).newPage();
    await register(adminPage, admin);
    localQuery(
      `insert into private.admin_users (user_id, granted_by)
       select id, id from auth.users where email = '${admin.email}'`,
    );
    await adminPage.goto("/admin/contacto");

    const fromVisitor = adminPage.getByRole("article", { name: visitor.name });
    await expect(fromVisitor).toContainText(`No llegó mi pedido ${stamp}.`);
    await expect(fromVisitor.getByRole("link", { name: visitor.email })).toHaveAttribute(
      "href",
      `mailto:${visitor.email}`,
    );
    await expect(fromVisitor.getByRole("link", { name: "+525587654321" })).toBeVisible();
    await expect(fromVisitor).toContainText("Sin cuenta");

    const fromMember = adminPage.getByRole("article", { name: member.name });
    await expect(fromMember).toContainText(`El vendedor no responde ${stamp}.`);
    await expect(fromMember.getByRole("link", { name: member.email })).toBeVisible();
    await expect(fromMember.getByRole("link", { name: "+523312345678" })).toBeVisible();
    await expect(fromMember).toContainText("Con cuenta");

    // Attending one leaves it on record.
    await fromVisitor.getByRole("button", { name: `Marcar como atendido el mensaje de ${visitor.name}` }).click();
    await expect(fromVisitor.getByText(/^Atendido el/)).toBeVisible();
    await adminPage.reload();
    await expect(
      adminPage.getByRole("article", { name: visitor.name }).getByText(/^Atendido el/),
    ).toBeVisible();
  });
});
