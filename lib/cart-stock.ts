/**
 * What a cart line should tell the buyer about stock, or null when there is
 * enough. Units can drop after a line was added — another buyer ordered, or the
 * seller recounted — and checkout refuses a line that asks for more than is
 * left, so the cart says it first.
 */
export function cartLineStockNotice(quantity: number, unitsAvailable: number): string | null {
  if (unitsAvailable < 1) return "Agotado";
  if (quantity <= unitsAvailable) return null;
  return unitsAvailable === 1 ? "Solo queda 1" : `Solo quedan ${unitsAvailable}`;
}
