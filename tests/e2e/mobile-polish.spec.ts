import { execFileSync } from "node:child_process";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Like the other end-to-end specs, this one registers a real account, so it
// must never reach the linked remote project. `npm run test:e2e` forces the
// local stack through scripts/e2e-env.mjs; running Playwright bare skips that.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

/** A phone the app has to fit: the narrowest common width, and a typical one. */
const phoneWidths = [320, 390] as const;

/** Apple and Google both put the floor for a touch target here. */
const MINIMUM_TAP = 44;

const stamp = `${Date.now()}-${process.pid}`;
const shopper = {
  email: `mobile-${stamp}@test.local`,
  name: "Comprador Movil",
  password: "plaza-volcanes-1",
};

/**
 * Routes a signed-in shopper reaches without first publishing anything. Each
 * one is swept for undersized controls, so the list stays to surfaces that
 * render from a bare account.
 */
const signedInRoutes = [
  "/",
  "/compras",
  "/mensajes",
  "/panel",
  "/panel/cuenta",
  "/panel/tiendas/nueva",
  "/terminos",
] as const;

/**
 * A long name, because `ProductRow` truncates it and `truncate` sets
 * `white-space: nowrap`, so the name reports its whole width as the row's
 * minimum. That minimum is what made the shop dashboard scroll sideways once a
 * grid column had no floor under it.
 *
 * The seeded row here has never reproduced that overflow on the local stack,
 * only against production data, so treat this route as tap-target coverage and
 * not as the guard for that bug.
 */
const longProductName = `Reloj Citizen Eco Drive Sapphire ${stamp}`;

const shopName = `Tienda movil ${stamp}`;
const shopSlug = `tienda-movil-${stamp}`;

const signedOutRoutes = ["/", "/ingresar", "/registro", "/vender"] as const;

type Undersized = {
  height: number;
  label: string;
  selector: string;
  width: number;
};

/**
 * Every control a finger has to hit, measured. Screen-reader-only inputs are
 * skipped: they are 1px on purpose and are driven by a visible label elsewhere,
 * so growing them would put an invisible target under the user's thumb.
 */
async function undersizedTapTargets(page: Page): Promise<Undersized[]> {
  return page.evaluate((minimum) => {
    const interactive =
      "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]";
    const found: Undersized[] = [];

    for (const element of Array.from(document.querySelectorAll(interactive))) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      if (style.visibility === "hidden" || style.display === "none") continue;
      // The sr-only pattern: a 1px box pulled out of flow behind a real label.
      if (rect.width <= 1 || rect.height <= 1) continue;

      // A halo pseudo-element stretches the hit box past the painted box, so
      // the target is whichever of the two is larger.
      const halo = getComputedStyle(element, "::after");
      const haloWidth = halo.content === "none" ? 0 : Number.parseFloat(halo.width) || 0;
      const haloHeight = halo.content === "none" ? 0 : Number.parseFloat(halo.height) || 0;
      const width = Math.max(rect.width, haloWidth);
      const height = Math.max(rect.height, haloHeight);

      // A checkbox stays a checkbox-sized square. What the finger aims at is
      // the label wrapping it, so a large enough label is the real target.
      const label = element.closest("label");
      if (label) {
        const labelRect = label.getBoundingClientRect();
        if (labelRect.height >= minimum && labelRect.width >= minimum) continue;
      }

      if (width < minimum || height < minimum) {
        found.push({
          height: Math.round(height),
          label:
            (element as HTMLElement).innerText?.trim() ||
            element.getAttribute("aria-label") ||
            element.getAttribute("name") ||
            "",
          selector: `${element.tagName.toLowerCase()}.${(element.className || "")
            .toString()
            .split(/\s+/)
            .slice(0, 3)
            .join(".")}`,
          width: Math.round(width),
        });
      }
    }

    return found;
  }, MINIMUM_TAP);
}

async function expectNoDocumentOverflow(page: Page) {
  const width = page.viewportSize()?.width;

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(width);
}

/** A shop may only take listings once administration has approved it. */
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

async function register(page: Page) {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill(shopper.name);
  await page.getByLabel("Correo electrónico").fill(shopper.email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña").fill(shopper.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

test.describe("mobile polish", () => {
  test.describe.configure({ mode: "serial" });

  let signedInState: Awaited<ReturnType<BrowserContext["storageState"]>>;
  /** The shop dashboard, which only exists once a shop does. */
  let shopRoute: string;

  test.beforeAll(async ({ browser }) => {
    if (!isLocal) {
      throw new Error(
        `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
          "This test registers a real account. Use `npm run test:e2e`.",
      );
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await register(page);

      await page.goto("/panel/tiendas/nueva");
      await page.getByLabel("Nombre de la tienda").fill(shopName);
      await page
        .getByLabel("Descripción")
        .fill("Tienda de prueba para medir la portada del panel en un telefono.");
      await page.getByLabel("Estado principal").selectOption({ index: 1 });
      await page.getByRole("button", { name: "Crear tienda" }).click();
      await expect(page).toHaveURL(/\/panel\/tiendas\/\d+/);
      shopRoute = new URL(page.url()).pathname;
      approveShopForPublication(shopSlug);

      // A listing, so the dashboard renders the row the overflow came from.
      await page.getByRole("link", { name: /agregar producto/i }).first().click();
      await expect(page).toHaveURL(/\/productos\/nuevo/);
      await page.getByLabel("Categoría", { exact: true }).selectOption({ index: 1 });
      await page.getByLabel("Subcategoría").selectOption({ index: 1 });
      await page.getByLabel("Nombre del producto").fill(longProductName);
      await page.getByLabel("Descripción").fill("Pieza de prueba para la portada del panel.");
      await page.getByLabel("Precio en MXN").fill("1899");
      await page.getByLabel("Unidades disponibles").fill("2");
      await page.getByRole("button", { name: "Guardar producto" }).click();
      await expect(page).toHaveURL(/\/panel\/productos\/\d+\/editar/);

      signedInState = await context.storageState();
    } finally {
      await context.close();
    }
  });

  for (const width of phoneWidths) {
    test(`gives every signed-out control a 44px target at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width },
      });
      const page = await context.newPage();

      try {
        for (const route of signedOutRoutes) {
          await page.goto(route);
          await expectNoDocumentOverflow(page);
          expect(await undersizedTapTargets(page), `${route} at ${width}px`).toEqual([]);
        }
      } finally {
        await context.close();
      }
    });

    test(`gives every signed-in control a 44px target at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        storageState: signedInState,
        viewport: { height: 844, width },
      });
      const page = await context.newPage();

      try {
        for (const route of [...signedInRoutes, shopRoute]) {
          await page.goto(route);
          await expectNoDocumentOverflow(page);
          expect(await undersizedTapTargets(page), `${route} at ${width}px`).toEqual([]);
        }
      } finally {
        await context.close();
      }
    });
  }

  test("puts every signed-in destination within reach of a thumb", async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      storageState: signedInState,
      viewport: { height: 844, width: 390 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/");

      const bar = page.getByRole("navigation", { name: "Navegación rápida" });
      await expect(bar).toBeVisible();

      // The reason the bar exists: /compras had no link at all below 640px.
      for (const [name, href] of [
        ["Explorar", "/"],
        ["Mensajes", "/mensajes"],
        ["Compras", "/compras"],
        ["Panel", "/panel"],
      ] as const) {
        const link = bar.getByRole("link", { name });
        await expect(link).toHaveAttribute("href", href);

        const box = await link.boundingBox();
        expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(MINIMUM_TAP);
        expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(MINIMUM_TAP);
      }

      // A fixed bar that covers the last row of content is worse than no bar.
      const clearance = await page.evaluate(() => {
        const main = document.querySelector("main");
        const nav = document.querySelector('[data-bottom-nav="true"]');
        if (!main || !nav) return null;

        return {
          barHeight: nav.getBoundingClientRect().height,
          padding: Number.parseFloat(getComputedStyle(main).paddingBottom) || 0,
        };
      });

      expect(clearance).not.toBeNull();
      expect(clearance!.padding).toBeGreaterThanOrEqual(clearance!.barHeight);
    } finally {
      await context.close();
    }
  });

  test("hands navigation back to the header on a desktop width", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { height: 900, width: 1280 } });
    const page = await context.newPage();

    try {
      await page.goto("/");
      await expect(page.getByRole("navigation", { name: "Navegación rápida" })).toBeHidden();
    } finally {
      await context.close();
    }
  });

  test("folds the legal shelf away on a phone", async ({ browser }) => {
    const phone = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { height: 844, width: 390 },
    });
    const phonePage = await phone.newPage();

    try {
      await phonePage.goto("/");

      const shelf = phonePage.locator("details.disclosure-mobile");
      const summary = shelf.locator("summary");

      await expect(shelf).toHaveJSProperty("open", false);
      // Closed, the eight links may not add to the height of the page.
      await expect(shelf.getByRole("link").first()).toBeHidden();

      const summaryBox = await summary.boundingBox();
      expect(summaryBox?.height).toBeGreaterThanOrEqual(MINIMUM_TAP);

      await summary.click();
      await expect(shelf).toHaveJSProperty("open", true);

      const revealed = shelf.getByRole("link");
      expect(await revealed.count()).toBeGreaterThan(0);
      for (const link of await revealed.all()) {
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(MINIMUM_TAP);
      }
    } finally {
      await phone.close();
    }
  });

  test("keeps the legal shelf open where the height costs nothing", async ({ browser }) => {
    const desktop = await browser.newContext({ viewport: { height: 900, width: 1280 } });
    const page = await desktop.newPage();

    try {
      await page.goto("/");

      // `disclosure-mobile` reveals a closed panel from lg up, so the links
      // read as a plain column there rather than as a toggle.
      await expect(page.locator("details.disclosure-mobile").getByRole("link").first()).toBeVisible();
    } finally {
      await desktop.close();
    }
  });
});
