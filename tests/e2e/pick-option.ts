import { expect, type Locator } from "@playwright/test";

/**
 * Picks an option the way a person's browser does, not the way
 * `locator.selectOption` does.
 *
 * Playwright fires `input` and `change` back to back from one script, so React
 * cannot render between them. A real pick dispatches each event natively, and
 * microtasks run after each one: React renders whatever the `input` handlers
 * changed before `change` arrives. A controlled select that only hears
 * `change` can be reset in that gap — the product category picker shipped
 * broken that way, with every selectOption-based spec still green.
 */
export async function pickOption(select: Locator, option: string | { index: number }) {
  await expect(select).toBeEnabled();
  const picked = await select.evaluate(async (element, option) => {
    if (!(element instanceof HTMLSelectElement)) throw new Error("pickOption needs a <select>.");
    const index =
      typeof option === "string"
        ? Array.from(element.options).findIndex((item) => item.value === option || item.label === option)
        : option.index;
    const target = element.options[index];
    if (!target) throw new Error(`No option ${JSON.stringify(option)} in #${element.id}.`);

    element.selectedIndex = index;
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    // The gap a native dispatch leaves: queued React work renders here.
    await new Promise((resolve) => setTimeout(resolve, 0));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return target.value;
  }, option);
  await expect(select).toHaveValue(picked);
}
