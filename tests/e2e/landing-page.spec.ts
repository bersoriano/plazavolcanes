import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";

// This spec creates an account, a shop, and a published product. Running
// Playwright directly can inherit the linked remote project from `.env.local`,
// so refuse unless scripts/e2e-env.mjs has forced a loopback Supabase URL.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(supabaseUrl);

const viewportWidths = [320, 390, 1440] as const;
const runId = `${Date.now()}-${process.pid}`;
const seller = {
  email: `landing-${runId}@test.local`,
  name: "Vendedora Accesible",
  password: "plaza-volcanes-1",
};
const shopName = `Taller responsivo ${runId}`;
const productName = `Maceta accesible ${runId}`;
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let sellerStorageState: Awaited<ReturnType<BrowserContext["storageState"]>>;

async function registerSeller(page: Page) {
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill(seller.name);
  await page.getByLabel("Correo electrónico").fill(seller.email);
  await page.getByLabel("Teléfono móvil").fill("3312345678");
  await page.getByLabel("Contraseña").fill(seller.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/panel/);
}

async function createPublishedListing(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await registerSeller(page);

    await page.goto("/panel/tiendas/nueva");
    await page.getByLabel("Nombre de la tienda").fill(shopName);
    await page
      .getByLabel("Descripción")
      .fill("Tienda aislada para verificar la portada responsiva y accesible.");
    await page.getByLabel("Estado principal").selectOption("MX-JAL");
    await page.getByRole("button", { name: "Crear tienda" }).click();
    await expect(page).toHaveURL(/\/panel\/tiendas\/\d+/);

    await page.getByLabel("Agregar producto", { exact: true }).click();
    await expect(page).toHaveURL(/\/productos\/nuevo/);
    await page.getByLabel("Categoría", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Subcategoría").selectOption({ index: 1 });
    await page.getByLabel("Nombre del producto").fill(productName);
    await page
      .getByLabel("Descripción")
      .fill("Publicación aislada para la regresión de portada y fallback de imagen.");
    await page.getByLabel("Precio en MXN").fill("320");
    await page.getByLabel("Unidades disponibles").fill("3");
    await page.locator("#product-images").setInputFiles({
      buffer: onePixelPng,
      mimeType: "image/png",
      name: `portada-${runId}.png`,
    });
    await page.getByRole("button", { name: "Publicar producto" }).click();
    await expect(page).toHaveURL(/\/panel\/productos\/\d+\/editar\?creado=1/);

    sellerStorageState = await context.storageState();
  } finally {
    await context.close();
  }
}

async function expectNoDocumentOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({
      innerWidth: page.viewportSize()?.width,
      scrollWidth: page.viewportSize()?.width,
    });
}

async function expectFocusVisibleAndUnclipped(locator: Locator) {
  await expect(locator).toBeFocused();

  const focus = await locator.evaluate((element) => {
    const target = element as HTMLElement;
    const style = getComputedStyle(target);
    const rect = target.getBoundingClientRect();
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
    const outlineOffset = Number.parseFloat(style.outlineOffset) || 0;
    const extent = outlineWidth + outlineOffset;
    const indicator = {
      bottom: rect.bottom + extent,
      left: rect.left - extent,
      right: rect.right + extent,
      top: rect.top - extent,
    };
    let clippingAncestor: { className: string; tagName: string } | null = null;

    for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const ancestorStyle = getComputedStyle(ancestor);
      const ancestorRect = ancestor.getBoundingClientRect();
      const clipsX = ["auto", "clip", "hidden", "scroll"].includes(ancestorStyle.overflowX);
      const clipsY = ["auto", "clip", "hidden", "scroll"].includes(ancestorStyle.overflowY);

      if (
        (clipsX && (indicator.left < ancestorRect.left || indicator.right > ancestorRect.right)) ||
        (clipsY && (indicator.top < ancestorRect.top || indicator.bottom > ancestorRect.bottom))
      ) {
        clippingAncestor = {
          className: ancestor.className,
          tagName: ancestor.tagName,
        };
        break;
      }
    }

    return {
      clippingAncestor,
      insideViewport:
        indicator.left >= 0 &&
        indicator.right <= window.innerWidth &&
        indicator.top >= 0 &&
        indicator.bottom <= window.innerHeight,
      outlineStyle: style.outlineStyle,
      outlineWidth,
    };
  });

  expect(focus.outlineStyle).not.toBe("none");
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(focus.insideViewport).toBe(true);
  expect(focus.clippingAncestor).toBeNull();
}

test.describe("landing responsive and accessibility gate", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    if (!isLocal) {
      throw new Error(
        `Refusing to run against ${supabaseUrl || "an unset NEXT_PUBLIC_SUPABASE_URL"}. ` +
          "These tests create a real account, shop, and product. Use `npm run test:e2e`.",
      );
    }

    await createPublishedListing(browser);
  });

  for (const width of viewportWidths) {
    test(`preserves the landing accessibility contract at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: sellerStorageState,
        viewport: { height: 900, width },
      });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      let failedCatalogImageRequests = 0;

      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await page.goto("/");

        await expect(
          page.getByRole("heading", { name: "Encuentra productos únicos cerca de ti." }),
        ).toBeVisible();
        await expect(page.getByRole("link", { name: "Plaza Volcanes, inicio" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Mi panel" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
        await expectNoDocumentOverflow(page);

        const productCard = page.getByRole("link", { name: new RegExp(productName) });
        await expect(productCard).toBeVisible();
        const productImage = productCard.getByRole("img", { name: productName });
        await expect(productImage).toBeVisible();
        await expect
          .poll(() =>
            productImage.evaluate(
              (element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth,
            ),
          )
          .toBeGreaterThan(0);

        const catalog = page.locator("#catalogo");
        await page.getByRole("link", { name: "Explorar productos" }).click();
        await expect(page).toHaveURL(/#catalogo$/);
        await expect(catalog).toBeFocused();
        await expect
          .poll(() =>
            catalog.evaluate((element) => {
              const rect = element.getBoundingClientRect();
              return rect.top < window.innerHeight && rect.bottom > 0;
            }),
          )
          .toBe(true);

        // The public UI cannot corrupt an uploaded object. Once hydration has
        // attached the real onError handler, make the rendered image issue a
        // real failing request instead of dispatching a synthetic error event.
        // The client-only catalog focus transition above is the hydration proof:
        // native hash navigation alone does not focus the target in Chromium.
        const imageSrc = await productImage.getAttribute("src");
        expect(imageSrc).not.toBeNull();
        const brokenImageUrl = new URL(imageSrc!);
        brokenImageUrl.searchParams.set("e2e-broken", runId);
        await page.route(brokenImageUrl.href, async (route) => {
          failedCatalogImageRequests += 1;
          await route.abort("failed");
        });
        await productImage.evaluate(
          (element, src) => {
            (element as HTMLImageElement).src = src;
          },
          brokenImageUrl.href,
        );
        await expect.poll(() => failedCatalogImageRequests).toBeGreaterThan(0);
        await expect(productCard.getByRole("img", { name: productName })).toHaveCount(0);
        await expect(productCard.locator("svg.lucide-image")).toBeVisible();

        const state = page.getByRole("combobox", { name: "Estado" });
        await expect(state).toBeVisible();
        await state.selectOption("jalisco");
        await expect(state).toHaveValue("jalisco");
        await page.getByRole("searchbox", { name: "Buscar productos" }).fill(productName);
        await page.getByRole("button", { name: "Buscar" }).click();
        await expect(page).toHaveURL((url) =>
          url.pathname === "/estado/jalisco" && url.searchParams.get("q") === productName,
        );
        await expect(page.getByRole("combobox", { name: "Estado" })).toHaveValue("jalisco");
        await expectNoDocumentOverflow(page);

        const categoryScroller = page
          .getByRole("navigation", { name: "Categorías de productos" })
          .locator('[aria-describedby="category-scroll-guidance"]')
          .first();
        const categoryOverflow = await categoryScroller.evaluate((element) => ({
          clientWidth: element.clientWidth,
          overflowX: getComputedStyle(element).overflowX,
          scrollWidth: element.scrollWidth,
        }));
        expect(categoryOverflow.overflowX).toBe("auto");
        if (width <= 390) {
          expect(categoryOverflow.scrollWidth).toBeGreaterThan(categoryOverflow.clientWidth);
        }

        const footerLinks = page.getByRole("contentinfo").getByRole("link");
        expect(await footerLinks.count()).toBeGreaterThan(0);
        for (const link of await footerLinks.all()) {
          const box = await link.boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }

        expect(pageErrors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }

  test("keeps the 320px keyboard sequence visible and unclipped", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: sellerStorageState,
      viewport: { height: 900, width: 320 },
    });
    const page = await context.newPage();

    try {
      await page.goto("/");

      const focusOrder = [
        page.getByRole("link", { name: "Plaza Volcanes, inicio" }),
        page.getByRole("link", { name: "Mi panel" }),
        page.getByRole("link", { name: "Mensajes" }),
        page.getByRole("button", { name: "Salir" }),
        page.getByRole("link", { name: "Explorar productos" }),
        page.getByRole("link", { name: "Abrir mi tienda" }).first(),
        page.getByRole("searchbox", { name: "Buscar productos" }),
        page.getByRole("combobox", { name: "Estado" }),
        page.getByRole("button", { name: "Buscar" }),
        page.getByRole("navigation", { name: "Categorías de productos" }).getByRole("link").first(),
      ];

      for (const target of focusOrder) {
        await page.keyboard.press("Tab");
        await expectFocusVisibleAndUnclipped(target);
      }

      await expectNoDocumentOverflow(page);
    } finally {
      await context.close();
    }
  });
});
