export function normalizeSearchQuery(query: string | undefined) {
  const normalized = query?.trim().slice(0, 80);
  return normalized || undefined;
}
