export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
) {
  let candidate = base;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function uniqueShopSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
) {
  return uniqueSlug(slugify(name) || "tienda", exists);
}

export async function uniqueProductSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
) {
  return uniqueSlug(slugify(name) || "producto", exists);
}
