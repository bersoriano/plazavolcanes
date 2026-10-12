/** Accept existing seller links; emit only the canonical intent value. */
export function resolveAuthIntent(intent: unknown, vender?: unknown): "vender" | undefined {
  return intent === "vender" || vender === "1" ? "vender" : undefined;
}
