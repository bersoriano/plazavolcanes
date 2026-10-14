import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// This spec registers accounts and sends them notices. `.env.local` points at
// the linked remote project, so `npm run test:e2e` routes through
// scripts/e2e-env.mjs, which forces the local stack. Running Playwright
// directly skips that, so the guard below refuses rather than trusting it.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

test.beforeAll(() => {
  if (!isLocal) {
    throw new Error(
      `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
        "These tests create real accounts and send them notices. Use `npm run test:e2e`.",
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

/**
 * Each run needs its own accounts, because e-mail addresses are unique. The
 * process id matters: this file's tests run in parallel workers that start in
 * the same millisecond often enough, and a worker that shared a stamp would
 * clean up the accounts another one is still using.
 */
const stamp = `${Date.now()}-${process.pid}`;
const password = "plaza-volcanes-1";
const admin = { email: `admin-notices-${stamp}@test.local`, name: `Administración ${stamp}` };
const member = { email: `member-notices-${stamp}@test.local`, name: `Persona ${stamp}` };
const emails = `('${admin.email}', '${member.email}')`;

async function register(page: Page, account: { email: string; name: string }) {
  await page.goto("/registro?paso=formulario");
  await page.getByLabel("Tu nombre").fill(account.name);
  await page.getByLabel("Correo electrónico").fill(account.email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

/**
 * Resolves once Realtime has registered the page's subscription to notices. A
 * channel reports itself subscribed before the server is actually listening,
 * so a notice sent in between would arrive over no socket at all; this waits
 * for the server's own word.
 */
function listeningForNotices(page: Page) {
  return new Promise<void>((resolve) => {
    page.on("websocket", (socket) => {
      socket.on("framereceived", ({ payload }) => {
        const text = typeof payload === "string" ? payload : "";
        if (text.includes("inbox-notices") && text.includes("Subscribed to PostgreSQL")) resolve();
      });
    });
  });
}

const inboxRows = (page: Page) =>
  page.getByRole("list", { name: "Conversaciones" }).getByRole("link");
const unreadMarkers = (page: Page) => page.getByLabel(/mensajes sin leer/i);

test.describe("notices from administration", () => {
  // Scoped to this group, so only the worker that created the accounts removes them.
  test.afterAll(() => {
    if (!isLocal) return;

    // Other suites assert on whole tables, so this one leaves nothing behind.
    // Removing a send removes the notices it delivered.
    localQuery(
      `delete from private.platform_notice_batches
       where sent_by in (select id from auth.users where email in ${emails})`,
    );
    localQuery(
      `delete from private.admin_users where user_id in (select id from auth.users where email in ${emails})`,
    );
    localQuery(`delete from auth.users where email in ${emails}`);
  });

  test("administration writes to one person, who can read it and not answer", async ({ browser }) => {
    test.setTimeout(120_000);

    const adminPage = await (await browser.newContext()).newPage();
    const memberPage = await (await browser.newContext()).newPage();

    await register(memberPage, member);
    await register(adminPage, admin);
    localQuery(
      `insert into private.admin_users (user_id, granted_by)
       select id, id from auth.users where email = '${admin.email}'`,
    );

    // The person has their inbox open, with nothing in it yet.
    const listening = listeningForNotices(memberPage);
    await memberPage.goto("/mensajes");
    await expect(memberPage.getByText("Aún no tienes mensajes")).toBeVisible();
    await listening;

    // The administrator writes to them from their card.
    const title = `Tu tienda necesita portada ${stamp}`;
    await adminPage.goto("/admin/usuarios");
    const card = adminPage.locator("article").filter({ hasText: member.email });
    await card.getByRole("button", { name: `Enviar aviso a ${member.name}` }).click();
    await card.getByLabel("Título", { exact: true }).fill(title);
    await card.getByLabel("Mensaje", { exact: true }).fill("Agrega una foto de portada para poder publicar.");
    await card.getByLabel(/^Enlace/).fill("/panel");
    await card.getByLabel(/^Texto del botón/).fill("Ir a mi panel");
    await card.getByRole("button", { name: "Enviar aviso", exact: true }).click();
    await expect(card.getByText("Aviso enviado.")).toBeVisible();

    // It arrives without the person doing anything, signed by the plaza.
    const row = inboxRows(memberPage).filter({ hasText: title });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText("Plaza Volcanes");
    await expect(row).toContainText(/Aviso/i);
    await expect(row.getByLabel("1 mensajes sin leer")).toBeVisible();

    // Opening it shows the message and its button, and no way to answer.
    await row.click();
    await expect(memberPage).toHaveURL(/\/mensajes\/avisos\/\d+/);
    const noticeUrl = memberPage.url();
    await expect(memberPage.getByRole("heading", { level: 1, name: "Plaza Volcanes" })).toBeVisible();
    await expect(memberPage.getByRole("heading", { level: 2, name: title })).toBeVisible();
    // Inside the notice itself: the list beside it previews the same words.
    await expect(
      memberPage.getByRole("article").getByText("Agrega una foto de portada para poder publicar."),
    ).toBeVisible();
    await expect(memberPage.getByRole("link", { name: "Ir a mi panel" })).toHaveAttribute("href", "/panel");
    await expect(memberPage.getByRole("textbox", { name: "Mensaje", exact: true })).toHaveCount(0);
    await expect(memberPage.getByText(/no admite respuesta/i)).toBeVisible();

    // Reading it clears the row's marker and the header's badge.
    await expect(unreadMarkers(memberPage)).toHaveCount(0);
    await memberPage.goto("/mensajes");
    await expect(inboxRows(memberPage).filter({ hasText: title })).toBeVisible();
    await expect(unreadMarkers(memberPage)).toHaveCount(0);

    // The plaza's filter holds it.
    await memberPage.getByRole("button", { name: /^Plaza Volcanes/ }).click();
    await expect(inboxRows(memberPage)).toHaveCount(1);

    // The administrator sees that it was read.
    await adminPage.goto("/admin/avisos");
    const sent = adminPage.getByRole("region", { name: "Enviados" });
    const entry = sent.getByRole("listitem").filter({ hasText: title });
    await expect(entry).toContainText(new RegExp(`${member.name} · Leído`, "i"));

    // An announcement asks before it goes anywhere. It is not sent here: it would
    // land in the inbox of every account the other specs are using at this moment.
    await adminPage.getByLabel("Título", { exact: true }).fill(`Mantenimiento ${stamp}`);
    await adminPage.getByLabel("Mensaje", { exact: true }).fill("La plaza estará en pausa el sábado por la noche.");
    await adminPage.getByRole("radio", { name: /Quienes venden/ }).check();
    await adminPage.getByRole("button", { name: "Enviar anuncio" }).click();
    await expect(adminPage.getByText(/Se enviará a \d+ personas?\./)).toBeVisible();
    await expect(adminPage.getByRole("button", { name: /^Enviar a \d+ personas?$/ })).toBeVisible();
    await adminPage.getByRole("button", { name: "Cancelar" }).click();
    await expect(adminPage.getByText(/Se enviará a/)).toHaveCount(0);

    // Retracting takes the notice back out of the person's inbox.
    await entry.getByRole("button", { name: `Retirar ${title}` }).click();
    await entry.getByRole("button", { name: "Retirar definitivamente" }).click();
    await expect(entry).toContainText(/Retirado el/i);
    await expect(entry.getByRole("button")).toHaveCount(0);

    await memberPage.goto("/mensajes");
    await expect(memberPage.getByText("Aún no tienes mensajes")).toBeVisible();
    await memberPage.goto(noticeUrl);
    await expect(memberPage.getByText("No encontramos ese aviso")).toBeVisible();
  });
});

test("a signed-out visitor is asked to sign in before reading a notice", async ({ page }) => {
  await page.goto("/mensajes/avisos/1");

  await expect(page).toHaveURL(/\/ingresar\?continuar=\/mensajes/);
});

test("the administration's notices page is closed to everyone else", async ({ page }) => {
  await page.goto("/admin/avisos");

  await expect(page).toHaveURL(/\/ingresar\?continuar=/);
});
