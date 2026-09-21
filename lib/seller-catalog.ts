import {
  getSellerPublicationState,
  type SellerListingFlags,
} from "@/lib/seller-publication";

/**
 * The catalogue is sorted into the four answers a seller acts on, plus the one
 * they can only wait out. The tabs carry these names in the query string, so
 * they are Spanish and they are part of the URL contract.
 */
export const CATALOG_TABS = ["todos", "publicados", "borradores", "vencidos", "bloqueados"] as const;

export type CatalogTab = (typeof CATALOG_TABS)[number];

/** Every bucket a single listing can land in — "todos" holds all of them. */
export type CatalogBucket = Exclude<CatalogTab, "todos">;

export type CatalogCounts = Record<CatalogTab, number>;

type ShopPublishingFlags = Pick<
  SellerListingFlags,
  "is_publishing_approved" | "publishing_reviewed_at"
>;

type CatalogListing = Pick<SellerListingFlags, "status" | "expires_at" | "is_admin_enabled"> & {
  name: string;
};

export function parseCatalogTab(value: string | string[] | undefined): CatalogTab {
  return typeof value === "string" && (CATALOG_TABS as readonly string[]).includes(value)
    ? (value as CatalogTab)
    : "todos";
}

/**
 * Which tab a listing belongs under, read from its effective state rather than
 * its `status` column: a row can say "published" while its date has passed or
 * while administration has it switched off.
 */
export function getCatalogBucket(
  listing: CatalogListing,
  shop: ShopPublishingFlags,
): CatalogBucket {
  const { kind } = getSellerPublicationState({ ...listing, ...shop });
  if (kind === "published") return "publicados";
  if (kind === "draft") return "borradores";
  if (kind === "expired") return "vencidos";
  return "bloqueados";
}

/** Lowercased and stripped of accents, so a phone keyboard finds "Café". */
function searchable(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function organizeCatalog<T extends CatalogListing>(
  listings: T[],
  shop: ShopPublishingFlags,
  { tab = "todos", search = "" }: { tab?: CatalogTab; search?: string },
): { visible: T[]; counts: CatalogCounts } {
  const counts: CatalogCounts = {
    todos: listings.length,
    publicados: 0,
    borradores: 0,
    vencidos: 0,
    bloqueados: 0,
  };

  // Counted before anything is filtered away: a tab has to keep announcing what
  // is behind it even while another tab is the one on screen.
  const bucketed = listings.map((listing) => {
    const bucket = getCatalogBucket(listing, shop);
    counts[bucket] += 1;
    return { listing, bucket };
  });

  const needle = searchable(search.trim());
  const visible = bucketed
    .filter(({ bucket }) => tab === "todos" || bucket === tab)
    .filter(({ listing }) => !needle || searchable(listing.name).includes(needle))
    .map(({ listing }) => listing);

  return { visible, counts };
}
