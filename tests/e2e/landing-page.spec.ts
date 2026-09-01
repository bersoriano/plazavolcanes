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
const headerBoundaryWidths = [400, 430, 640] as const;
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

function contrastRatio(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${color}`);

    const [red, green, blue] = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectLightSurfaceFocusContrast(locator: Locator) {
  const outlineColor = await locator.evaluate((element) => getComputedStyle(element).outlineColor);

  expect(contrastRatio(outlineColor, "rgb(255, 255, 255)")).toBeGreaterThanOrEqual(3);
}

async function expectDarkSurfaceFocusContrast(locator: Locator) {
  const colors = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      innerRingColor: style.boxShadow.match(/rgba?\([^)]*\)/)?.[0] ?? "",
    };
  });

  expect(colors.innerRingColor).not.toBe("");
  expect(contrastRatio(colors.innerRingColor, colors.backgroundColor)).toBeGreaterThanOrEqual(3);
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
      let releaseScripts: (() => void) | undefined;
      const initialCatalogImageFailed = new Promise<void>((resolve) => {
        releaseScripts = resolve;
      });

      page.on("pageerror", (error) => pageErrors.push(error.message));

      try {
        await page.route("**/*", async (route) => {
          const request = route.request();
          const isCatalogImage =
            request.resourceType() === "image" &&
            request.url().includes("/storage/v1/object/public/catalogo/");

          if (isCatalogImage) {
            failedCatalogImageRequests += 1;
            releaseScripts?.();
            await route.abort("failed");
            return;
          }

          if (request.resourceType() === "script") {
            await initialCatalogImageFailed;
          }

          await route.continue();
        });
        await page.goto("/");

        await expect(
          page.getByRole("heading", {
            name: "Bienvenido: crea tu tienda y sube lo que quieras vender.",
          }),
        ).toBeVisible();
        await expect(page.getByRole("link", { name: "Plaza Volcanes, inicio" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();

        // Below the medium breakpoint the quick access bar carries the
        // destinations; the header only shows them once there is room to
        // spell them out.
        const quickAccess = page.getByRole("navigation", { name: "Navegación rápida" });
        if (width < 768) {
          await expect(quickAccess.getByRole("link", { name: /Panel/ })).toBeVisible();
          await expect(quickAccess.getByRole("link", { name: /Compras/ })).toBeVisible();
          await expect(page.getByRole("link", { name: "Mi panel" })).toBeHidden();
        } else {
          await expect(page.getByRole("link", { name: "Mi panel" })).toBeVisible();
          await expect(quickAccess).toBeHidden();
        }
        await expectNoDocumentOverflow(page);

        const productCard = page.getByRole("link", { name: new RegExp(productName) });
        await expect(productCard).toBeVisible();
        await expect.poll(() => failedCatalogImageRequests).toBeGreaterThan(0);

        const productCards = page.locator("#catalogo a.group.block");
        const productCardCount = await productCards.count();
        expect(productCardCount).toBeGreaterThan(0);
        for (let index = 0; index < productCardCount; index += 1) {
          const card = productCards.nth(index);
          await expect(card.getByRole("img")).toHaveCount(0);
          await expect(card.locator("svg.lucide-image")).toBeVisible();
        }

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
        const state = page.getByRole("combobox", { name: "Estado" });
        await expect(state).toBeVisible();
        const stateBox = await state.boundingBox();
        expect(stateBox).not.toBeNull();
        expect(stateBox!.height).toBeGreaterThanOrEqual(44);
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

  test("keeps the catalog destination below the sticky header on compact screens", async ({
    browser,
  }) => {
    for (const width of [320, 390]) {
      const context = await browser.newContext({
        storageState: sellerStorageState,
        viewport: { height: 900, width },
      });
      const page = await context.newPage();

      try {
        await page.goto("/");
        await page.getByRole("link", { name: "Explorar productos" }).click();
        await expect(page).toHaveURL(/#catalogo$/);

        const destination = await page.locator("#catalogo").evaluate((catalog) => {
          const heading = catalog.querySelector("#catalogo-heading");
          const header = document.querySelector("header");
          return {
            headingClearsHeader: Boolean(
              header &&
                heading &&
                heading.getBoundingClientRect().top >= header.getBoundingClientRect().bottom,
            ),
            scrollMarginTop: Number.parseFloat(getComputedStyle(catalog).scrollMarginTop) || 0,
          };
        });
        expect(destination.headingClearsHeader).toBe(true);
        expect(destination.scrollMarginTop).toBeGreaterThanOrEqual(76);
      } finally {
        await context.close();
      }
    }
  });

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
        // "Mi panel" and "Mensajes" are display:none at this width now: the
        // quick access bar holds them, so they leave the tab sequence here.
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

        if (target === focusOrder[0]) await expectLightSurfaceFocusContrast(target);
        if (target === focusOrder[4]) await expectDarkSurfaceFocusContrast(target);
      }

      const navigation = page.getByRole("navigation", { name: "Categorías de productos" });
      const rootScroller = navigation.locator('[aria-describedby="category-scroll-guidance"]').first();
      await rootScroller.getByRole("link").nth(1).click();
      await expect(page).toHaveURL(/categoria=/);

      const activeNavigation = page.getByRole("navigation", { name: "Categorías de productos" });
      const activeRootScroller = activeNavigation
        .locator('[aria-describedby="category-scroll-guidance"]')
        .first();
      const subcategoryScroller = activeNavigation.locator('[aria-label^="Subcategorías de "]');
      await expect(subcategoryScroller).toBeVisible();
      await activeRootScroller.getByRole("link").last().focus();
      await page.keyboard.press("Tab");
      await expectFocusVisibleAndUnclipped(subcategoryScroller.getByRole("link").first());

      await expectNoDocumentOverflow(page);
    } finally {
      await context.close();
    }
  });

  test("keeps the signed-in header stable at reveal boundaries", async ({ browser }) => {
    for (const width of headerBoundaryWidths) {
      const context = await browser.newContext({
        storageState: sellerStorageState,
        viewport: { height: 900, width },
      });
      const page = await context.newPage();

      try {
        await page.goto("/");

        const home = page.getByRole("link", { name: "Plaza Volcanes, inicio" });
        const navigation = page.getByRole("navigation", { name: "Navegación principal" });
        const brandLabel = home.getByText("Plaza Volcanes");
        const panelLabel = navigation.getByText("Mi panel", { exact: true });
        const messagesLabel = navigation.getByText("Mensajes", { exact: true });
        const signOutLabel = navigation.getByText("Salir", { exact: true });

        if (width < 640) await expect(brandLabel).toBeHidden();
        else await expect(brandLabel).toBeVisible();
        await expect(panelLabel).toBeHidden();
        await expect(messagesLabel).toBeHidden();
        await expect(signOutLabel).toBeHidden();

        const markBox = await home.locator("span").first().boundingBox();
        expect(markBox).not.toBeNull();
        expect(markBox!.width).toBeGreaterThanOrEqual(36);
        expect(markBox!.height).toBeGreaterThanOrEqual(36);

        const headerLayout = await page.locator("header").evaluate((header) => {
          const homeControl = header.querySelector('a[aria-label="Plaza Volcanes, inicio"]');
          const primaryNavigation = header.querySelector('nav[aria-label="Navegación principal"]');
          const headerRect = header.getBoundingClientRect();
          const homeRect = homeControl?.getBoundingClientRect();
          const navigationRect = primaryNavigation?.getBoundingClientRect();

          return {
            controlsOverlap: Boolean(homeRect && navigationRect && homeRect.right > navigationRect.left),
            headerHeight: headerRect.height,
            navigationInsideHeader: Boolean(
              navigationRect &&
                navigationRect.top >= headerRect.top &&
                navigationRect.bottom <= headerRect.bottom,
            ),
          };
        });

        expect(headerLayout.controlsOverlap).toBe(false);
        expect(headerLayout.headerHeight).toBeGreaterThanOrEqual(76);
        expect(headerLayout.headerHeight).toBeLessThanOrEqual(77);
        expect(headerLayout.navigationInsideHeader).toBe(true);
        await expectNoDocumentOverflow(page);
      } finally {
        await context.close();
      }
    }
  });
});
