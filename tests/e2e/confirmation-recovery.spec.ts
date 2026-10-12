import { expect, test, type Page } from "@playwright/test";

// Opt-in: other suites use an auto-confirming local stack. This suite needs
// confirmation enabled, the checked-in template and the local inbox.
test.skip(process.env.CONFIRMATION_E2E !== "1", "Requires a local confirmation-enabled Auth service.");
test.describe.configure({ mode: "serial" });

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const inboxUrl = process.env.CONFIRMATION_INBOX_URL ?? "http://127.0.0.1:54324";
const password = "plaza-volcanes-confirmation-1";
let sequence = 0;

function assertLoopback(value: string) {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Confirmation tests must use local services only.");
  }
}

test.beforeAll(async () => {
  assertLoopback(apiUrl);
  assertLoopback(inboxUrl);
  const response = await fetch(`${apiUrl}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
  });
  const settings = await response.json();
  expect(settings.mailer_autoconfirm).toBe(false);
});

async function register(page: Page, seller = true, continuar?: string) {
  const mailbox = `confirmation-${Date.now()}-${++sequence}`;
  const email = `${mailbox}@test.local`;
  const params = new URLSearchParams(seller ? { vender: "1" } : { paso: "formulario" });
  if (continuar) params.set("continuar", continuar);
  await page.goto(`/registro?${params}`);
  await page.getByLabel("Tu nombre").fill("Confirmación Prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("status")).toContainText("Revisa tu correo");
  return { mailbox, email };
}

async function emailLink(mailbox: string, afterId?: string) {
  let messageId = "";
  await expect.poll(async () => {
    const response = await fetch(`${inboxUrl}/api/v1/search?query=${encodeURIComponent(`to:${mailbox}@test.local`)}`);
    const { messages } = await response.json() as { messages: { ID: string }[] };
    messageId = messages.find((message) => message.ID !== afterId)?.ID ?? "";
    return messageId;
  }).not.toBe("");
  const response = await fetch(`${inboxUrl}/api/v1/message/${messageId}`);
  const message = await response.json();
  const html = message.HTML as string;
  const href = html.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!href) throw new Error("Confirmation email has no link.");
  assertLoopback(href);
  const link = new URL(href);
  expect(link.pathname).toBe("/auth/confirm");
  expect(link.searchParams.get("type")).toBe("signup");
  expect(link.searchParams.get("token_hash")).toBeTruthy();
  return { href, messageId };
}

// Reconstruct the stock ConfirmationURL to exercise existing PKCE emails as
// well as the new direct token-hash template, using the same real email token.
function legacyLink(href: string) {
  const callback = new URL(href);
  const token = callback.searchParams.get("token_hash")!;
  callback.searchParams.delete("token_hash");
  const verify = new URL(`${apiUrl}/auth/v1/verify`);
  verify.searchParams.set("token", token);
  verify.searchParams.set("type", "signup");
  verify.searchParams.set("redirect_to", callback.toString());
  return verify.toString();
}

async function signIn(page: Page, email: string, destination: RegExp) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page).toHaveURL(destination);
}

test("direct confirmation works in a different browser and persists seller session", async ({ browser, page }) => {
  const account = await register(page);
  const { href } = await emailLink(account.mailbox);
  const other = await browser.newContext();
  try {
    const opened = await other.newPage();
    await opened.goto(href);
    await expect(opened).toHaveURL(/\/panel\/tiendas\/nueva$/);
    await opened.reload();
    await expect(opened).toHaveURL(/\/panel\/tiendas\/nueva$/);
  } finally { await other.close(); }
});

test("stock PKCE confirmation works in the signup browser", async ({ page }) => {
  const account = await register(page);
  const { href } = await emailLink(account.mailbox);
  await page.goto(legacyLink(href));
  await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
});

test("stock PKCE confirmation in another browser recovers through seller sign-in", async ({ browser, page }) => {
  const account = await register(page);
  const { href } = await emailLink(account.mailbox);
  const other = await browser.newContext();
  try {
    const opened = await other.newPage();
    await opened.goto(legacyLink(href));
    await expect(opened).toHaveURL(/\/ingresar\?error=sesion_confirmacion.*intent=vender/);
    await expect(opened.getByRole("status")).toContainText("iniciar sesión automáticamente");
    await signIn(opened, account.email, /\/panel\/tiendas\/nueva$/);
  } finally { await other.close(); }
});

test("overlapping signups recover the earlier account after overwritten PKCE verifier", async ({ page }) => {
  const first = await register(page);
  const firstLink = await emailLink(first.mailbox);
  const second = await register(page, false);
  await emailLink(second.mailbox);
  await page.goto(legacyLink(firstLink.href));
  await expect(page).toHaveURL(/\/ingresar\?error=sesion_confirmacion.*intent=vender/);
  await signIn(page, first.email, /\/panel\/tiendas\/nueva$/);
});

test("already-used direct link offers sign-in and keeps seller context", async ({ browser, page }) => {
  const account = await register(page);
  const { href } = await emailLink(account.mailbox);
  await page.goto(href);
  await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
  const other = await browser.newContext();
  try {
    const opened = await other.newPage();
    await opened.goto(href);
    await expect(opened).toHaveURL(/\/ingresar\?error=confirmacion.*intent=vender/);
    await signIn(opened, account.email, /\/panel\/tiendas\/nueva$/);
  } finally { await other.close(); }
});

test("invalid link allows private resend and fresh confirmation", async ({ page }) => {
  const account = await register(page);
  const first = await emailLink(account.mailbox);
  // The local provider enforces a one-second resend cooldown. Acceptance is
  // deliberately private, so wait for that limit before expecting delivery.
  const resendReadyAt = Date.now() + 1100;
  await page.goto("/auth/confirm?type=signup&token_hash=expired&intent=vender");
  await expect(page.getByRole("status")).toContainText("expirado");
  await page.getByRole("link", { name: "Reenviar correo de confirmación" }).click();
  await expect(page).toHaveURL(/\/confirmar-correo\?intent=vender$/);
  await page.getByLabel("Correo electrónico").fill(account.email);
  await expect.poll(() => Date.now()).toBeGreaterThan(resendReadyAt);
  await page.getByRole("button", { name: "Reenviar confirmación" }).click();
  await expect(page.getByRole("status")).toContainText("Si ese correo");
  const fresh = await emailLink(account.mailbox, first.messageId);
  await page.goto(fresh.href);
  await expect(page).toHaveURL(/\/panel\/tiendas\/nueva$/);
});

test("direct confirmation preserves validated continuation before seller destination", async ({ page }) => {
  const account = await register(page, true, "/panel/cuenta");
  const { href } = await emailLink(account.mailbox);
  await page.goto(href);
  await expect(page).toHaveURL(/\/panel\/cuenta$/);
});

test("direct token confirmation survives overlapping signups", async ({ browser, page }) => {
  const first = await register(page);
  const firstLink = await emailLink(first.mailbox);
  const second = await register(page, false);
  await emailLink(second.mailbox);
  const other = await browser.newContext();
  try {
    const opened = await other.newPage();
    await opened.goto(firstLink.href);
    await expect(opened).toHaveURL(/\/panel\/tiendas\/nueva$/);
  } finally { await other.close(); }
});

test("a truly expired email offers resend without claiming confirmation", async ({ page }) => {
  const expiry = Number(process.env.CONFIRMATION_OTP_EXP_SECONDS);
  test.skip(!Number.isInteger(expiry) || expiry < 1 || expiry > 20, "Needs a dedicated Auth service with short OTP expiry.");
  const account = await register(page);
  const { href } = await emailLink(account.mailbox);
  await new Promise((resolve) => setTimeout(resolve, (expiry + 1) * 1000));
  await page.goto(href);
  await expect(page).toHaveURL(/\/ingresar\?error=confirmacion.*intent=vender/);
  await expect(page.getByRole("status")).toContainText("expirado");
  await expect(page.getByRole("link", { name: "Reenviar correo de confirmación" })).toHaveAttribute("href", "/confirmar-correo?intent=vender");
  await signInWithUnconfirmedEmail(page, account.email);
});

async function signInWithUnconfirmedEmail(page: Page, email: string) {
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByText(/Confirma tu correo antes de ingresar/)).toBeVisible();
}
