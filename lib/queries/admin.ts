export type AdminMarketplaceProductState =
  | "draft"
  | "pending"
  | "public"
  | "admin-disabled"
  | "expired";

/** The flat row returned by public.list_admin_marketplace_users(). */
export type AdminMarketplaceRpcRow = {
  user_id: string;
  email: string | null;
  user_created_at: string;
  display_name: string | null;
  shop_limit: number;
  shop_id: number | null;
  shop_name: string | null;
  shop_slug: string | null;
  shop_created_at: string | null;
  shop_is_publishing_approved: boolean | null;
  product_id: number | null;
  product_name: string | null;
  product_slug: string | null;
  product_status: string | null;
  product_is_admin_enabled: boolean | null;
  product_expires_at: string | null;
  product_created_at: string | null;
  product_updated_at: string | null;
};

export type AdminMarketplaceProduct = {
  id: number;
  name: string;
  slug: string;
  state: AdminMarketplaceProductState;
  isAdminEnabled: boolean;
  expiresAt: string | null;
  effectiveVisibility: boolean;
  createdAt: string;
  updatedAt: string;
};

function adminProductState(row: AdminMarketplaceRpcRow): AdminMarketplaceProductState {
  if (row.product_status === "draft") return "draft";
  if (row.product_status === "expired") return "expired";
  if (!row.product_is_admin_enabled) return "admin-disabled";
  if (!row.shop_is_publishing_approved) return "pending";
  if (
    row.product_expires_at === null ||
    new Date(row.product_expires_at).getTime() <= Date.now()
  ) {
    return "expired";
  }
  return "public";
}

export type AdminMarketplaceShop = {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  isPublishingApproved: boolean;
  products: AdminMarketplaceProduct[];
};

export type AdminMarketplaceUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  shopLimit: number;
  shops: AdminMarketplaceShop[];
};

export function mapAdminMarketplaceUsers(
  rows: AdminMarketplaceRpcRow[],
): AdminMarketplaceUser[] {
  const users: AdminMarketplaceUser[] = [];
  const usersById = new Map<string, AdminMarketplaceUser>();
  const shopsByKey = new Map<string, AdminMarketplaceShop>();
  const productKeys = new Set<string>();

  for (const row of rows) {
    let user = usersById.get(row.user_id);
    if (!user) {
      user = {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.user_created_at,
        shopLimit: row.shop_limit,
        shops: [],
      };
      usersById.set(row.user_id, user);
      users.push(user);
    }

    if (
      row.shop_id === null ||
      row.shop_name === null ||
      row.shop_slug === null ||
      row.shop_created_at === null ||
      row.shop_is_publishing_approved === null
    ) {
      continue;
    }

    const shopKey = `${row.user_id}:${row.shop_id}`;
    let shop = shopsByKey.get(shopKey);
    if (!shop) {
      shop = {
        id: row.shop_id,
        name: row.shop_name,
        slug: row.shop_slug,
        createdAt: row.shop_created_at,
        isPublishingApproved: row.shop_is_publishing_approved,
        products: [],
      };
      shopsByKey.set(shopKey, shop);
      user.shops.push(shop);
    }

    if (
      row.product_id === null ||
      row.product_name === null ||
      row.product_slug === null ||
      row.product_created_at === null ||
      row.product_updated_at === null ||
      row.product_is_admin_enabled === null ||
      (row.product_status !== "draft" &&
        row.product_status !== "published" &&
        row.product_status !== "expired")
    ) {
      continue;
    }

    const productKey = `${row.shop_id}:${row.product_id}`;
    if (!productKeys.has(productKey)) {
      productKeys.add(productKey);
      const state = adminProductState(row);
      shop.products.push({
        id: row.product_id,
        name: row.product_name,
        slug: row.product_slug,
        state,
        isAdminEnabled: row.product_is_admin_enabled,
        expiresAt: row.product_expires_at,
        effectiveVisibility: state === "public",
        createdAt: row.product_created_at,
        updatedAt: row.product_updated_at,
      });
    }
  }

  return users;
}
