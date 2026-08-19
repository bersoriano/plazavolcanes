import "server-only";

import type { Product, Shop } from "@/lib/database.types";
import { normalizeSearchQuery } from "@/lib/queries/catalog";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCatalogImageUrl } from "@/lib/storage";

export type CatalogProduct = Pick<
  Product,
  | "id"
  | "name"
  | "description"
  | "price_mxn"
  | "condition"
  | "used_condition"
  | "created_at"
> & {
  image_path: string | null;
  shop: { name: string; slug: string };
};

export type CatalogShop = Shop & { imageUrl: string | null };

const productSelection =
  "id, name, description, price_mxn, condition, used_condition, image_path, created_at, shops!inner(name, slug)";

function mapProduct(item: {
  id: number;
  name: string;
  description: string;
  price_mxn: number;
  condition: "new" | "used";
  used_condition: "mint" | "good" | "fair" | "bad" | "scrap" | null;
  image_path: string | null;
  created_at: string;
  shops: { name: string; slug: string };
}): CatalogProduct {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price_mxn: item.price_mxn,
    condition: item.condition,
    used_condition: item.used_condition,
    image_path: getCatalogImageUrl(item.image_path),
    created_at: item.created_at,
    shop: item.shops,
  };
}

export async function getHomeCatalog(query?: string) {
  if (!isSupabaseConfigured()) {
    return { products: [] as CatalogProduct[], shops: [] as CatalogShop[] };
  }

  const supabase = await createServerSupabaseClient();
  const normalizedQuery = normalizeSearchQuery(query);
  let productsQuery = supabase
    .from("products")
    .select(productSelection)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(24);

  if (normalizedQuery) productsQuery = productsQuery.ilike("name", `%${normalizedQuery}%`);

  const [productsResult, shopsResult] = await Promise.all([
    productsQuery,
    supabase.from("shops").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  return {
    products: (productsResult.data ?? []).map(mapProduct),
    shops: (shopsResult.data ?? []).map((shop) => ({
      ...shop,
      imageUrl: getCatalogImageUrl(shop.image_path),
    })),
  };
}

export async function getPublicShop(slug: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data: shop } = await supabase.from("shops").select("*").eq("slug", slug).maybeSingle();
  if (!shop) return null;

  const { data: products } = await supabase
    .from("products")
    .select(productSelection)
    .eq("shop_id", shop.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return {
    ...shop,
    imageUrl: getCatalogImageUrl(shop.image_path),
    products: (products ?? []).map(mapProduct),
  };
}

export async function getPublicProduct(id: number) {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("products")
    .select(productSelection)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  return data ? mapProduct(data) : null;
}
