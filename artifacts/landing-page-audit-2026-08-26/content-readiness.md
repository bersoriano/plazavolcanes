# Marketplace content-readiness gate

Date checked: 2026-08-26

Scope: default Mexico market; safe, read-only local evidence only.
Gate result: **NOT PASSED — BLOCKED.** No production requirement is directly evidenced.

Release-control record: this is the repository-local landing release checklist/gate for this audit. No external ticket system is known or authorized. The landing must remain blocked until each production requirement in this record is directly evidenced.

## Sources and method

1. Read-only query against the already-running local Supabase database (`supabase_db_plaza-volcanes-shop`). Each query used `BEGIN READ ONLY` and `ROLLBACK`; no data, status, seed, storage object, or service was changed.
2. Repository configuration at `supabase/config.toml:66-71`: local reset is configured to use `supabase/seed.sql`, but that file is absent from this worktree. No reset or seed operation was run.
3. Schema/migration review:
   - `supabase/migrations/20260819173000_add_categories_and_search.sql:3-14,662-674` defines the category table (`is_active` defaults to true) and inserts 11 product root categories. The **11 active roots below is an observed local-query count**, not a claim that the migration alone proves them active or populated in production.
   - `supabase/migrations/20260821200000_add_product_images.sql:1-10,84-121` defines position `0` as a product cover and syncs it to `products.image_path`.
   - `lib/queries/catalog.server.ts:40-41,256-262,407-429` shows the public catalog reads published MX products, their shop data, and image paths.

## Reproducible read-only inventory query

Definitions used by the query:

- **Default market:** `country_code = 'MX'`.
- **Public shop:** a row in `public.shops` in the default market. This is appropriate locally because the repository grants anonymous select and defines `shops_are_public` with `using (true)` in `supabase/migrations/20260819065028_create_marketplace.sql:30-41`.
- **Seller completeness:** an inner-joined shop, a non-null `shop_id`, and non-blank `shop_name`.
- **Location completeness:** `country_code = 'MX'` and at least one `administrative_area_codes` entry. **Represented state:** a distinct entry from those codes among published MX products.
- **Primary-image fallback:** non-blank `product_images.storage_path` at `position = 0`, otherwise non-blank legacy `products.image_path`.
- **Duplicate path:** an exact, non-null primary-image-path value used by more than one published MX product. This is a mechanical candidate list only; it cannot determine whether products are unrelated.

Run this exact SQL in the already-running local database with `psql -X -qAt -F $'\\t'`, preceded by `BEGIN READ ONLY` and followed by `ROLLBACK`:

```sql
WITH published_mx AS (
  SELECT
    p.id,
    p.shop_id,
    p.category_id,
    p.name,
    p.price_mxn,
    p.condition,
    p.image_path,
    s.name AS shop_name,
    s.country_code,
    s.administrative_area_codes
  FROM public.products AS p
  JOIN public.shops AS s ON s.id = p.shop_id
  WHERE p.status = 'published'
    AND s.country_code = 'MX'
),
primary_images AS (
  SELECT product_id, storage_path
  FROM public.product_images
  WHERE position = 0
),
checked_published_mx AS (
  SELECT
    p.*,
    COALESCE(
      NULLIF(BTRIM(pi.storage_path), ''),
      NULLIF(BTRIM(p.image_path), '')
    ) AS primary_image_path
  FROM published_mx AS p
  LEFT JOIN primary_images AS pi ON pi.product_id = p.id
),
populated_root_categories AS (
  SELECT DISTINCT COALESCE(c.parent_id, c.id) AS root_category_id
  FROM published_mx AS p
  JOIN public.categories AS c ON c.id = p.category_id
),
represented_states AS (
  SELECT DISTINCT area_code
  FROM published_mx AS p
  CROSS JOIN LATERAL UNNEST(
    COALESCE(p.administrative_area_codes, ARRAY[]::text[])
  ) AS area_code
),
incomplete_listings AS (
  SELECT *
  FROM checked_published_mx
  WHERE NULLIF(BTRIM(name), '') IS NULL
     OR price_mxn IS NULL
     OR condition IS NULL
     OR shop_id IS NULL
     OR NULLIF(BTRIM(shop_name), '') IS NULL
     OR country_code <> 'MX'
     OR COALESCE(CARDINALITY(administrative_area_codes), 0) = 0
     OR primary_image_path IS NULL
),
duplicate_paths AS (
  SELECT primary_image_path
  FROM checked_published_mx
  WHERE primary_image_path IS NOT NULL
  GROUP BY primary_image_path
  HAVING COUNT(*) > 1
)
SELECT 'active_product_root_category_definitions' AS metric,
       COUNT(*)::text AS observed
FROM public.categories
WHERE parent_id IS NULL
  AND listing_type = 'product'
  AND is_active
UNION ALL
SELECT 'duplicate_non_null_primary_image_paths_mx', COUNT(*)::text
FROM duplicate_paths
UNION ALL
SELECT 'duplicate_primary_image_listing_ids_mx',
       COALESCE(STRING_AGG(c.id::text, ',' ORDER BY c.id), '(none)')
FROM checked_published_mx AS c
JOIN duplicate_paths AS d USING (primary_image_path)
UNION ALL
SELECT 'incomplete_published_listing_ids_mx',
       COALESCE(STRING_AGG(id::text, ',' ORDER BY id), '(none)')
FROM incomplete_listings
UNION ALL
SELECT 'populated_root_categories_mx', COUNT(*)::text
FROM populated_root_categories
UNION ALL
SELECT 'public_shops_mx', COUNT(*)::text
FROM public.shops
WHERE country_code = 'MX'
UNION ALL
SELECT 'published_mx_with_missing_title_price_condition_seller_location_or_primary_path',
       COUNT(*)::text
FROM incomplete_listings
UNION ALL
SELECT 'published_products_all_markets', COUNT(*)::text
FROM public.products
WHERE status = 'published'
UNION ALL
SELECT 'published_products_mx', COUNT(*)::text
FROM published_mx
UNION ALL
SELECT 'represented_mexican_states_mx', COUNT(*)::text
FROM represented_states
ORDER BY metric;
```

Result snapshot from 2026-08-26 (tab-separated `metric` and `observed`; SHA-256 of these exact ten lines plus the final newline: `61e8cd873d1d344ee071585b60d36603aa1345a1c37c22e5cbe41225a96032dc`):

```text
active_product_root_category_definitions	11
duplicate_non_null_primary_image_paths_mx	0
duplicate_primary_image_listing_ids_mx	(none)
incomplete_published_listing_ids_mx	(none)
populated_root_categories_mx	0
public_shops_mx	0
published_mx_with_missing_title_price_condition_seller_location_or_primary_path	0
published_products_all_markets	0
published_products_mx	0
represented_mexican_states_mx	0
```

The zero missing-field and duplicate-path counts are not passes: the source rows are empty, so both listing-ID fields are `(none)`. Production and semantic image-reuse checks remain not verifiable.

## Observed local counts

| Measure | Observed local count |
| --- | ---: |
| Published products, all markets | 0 |
| Published products, Mexico | 0 |
| Public shops, Mexico | 0 |
| Active product root-category definitions | 11 |
| Populated root categories among published Mexico products | 0 |
| Mexican states represented among published Mexico products | 0 |
| Published Mexico products missing a checked required field or primary-image path | 0 of 0 |
| Repeated non-null primary-image paths among published Mexico products | 0 paths / 0 listings |

## Required threshold assessment

| Requirement | Threshold | Local evidence | Result | Production result |
| --- | --- | --- | --- | --- |
| Published products | 24–40 | 0 | **Fail** | **Not verifiable** |
| Public shops | 8–12 | 0 | **Fail** | **Not verifiable** |
| Populated root categories | At least 4 | 0; 11 definitions exist but none has a published local product | **Fail** | **Not verifiable** |
| Represented Mexican states | At least 3 | 0 among published local MX products | **Fail** | **Not verifiable** |
| Required product metadata | Every published listing has title, price, condition, seller, and location | No published local listings to inspect; the zero missing-field count is vacuous | **Not verifiable** | **Not verifiable** |
| Loadable primary image | Every published listing has one | No published local listings; no storage-object or HTTP-load check was performed | **Not verifiable** | **Not verifiable** |
| Unrelated primary-image reuse | None | No local primary images to compare; a path comparison cannot judge whether two products are unrelated | **Not verifiable** | **Not verifiable** |
| Visible copy normalization | Spelling, accents, title case, bios, conditions, locations reviewed | No published local content to review | **Not verifiable** | **Not verifiable** |
| First-row visual mix | Useful category/shop variety at 1440 px and 390 px | No local published catalog rows to assess | **Not verifiable** | **Not verifiable** |

## Listing evidence and quarantine result

No local published listing IDs were returned, so there are no local incomplete-listing IDs or duplicate-image IDs to list. This is not evidence that production has no incomplete listings. No listing was moved to draft, and no visible copy was edited.

## Launch blockers and required follow-up

| Blocker | Owner | Required action |
| --- | --- | --- |
| Launch-minimum inventory is not evidenced | Unassigned | In the production admin/product flow, inventory 24–40 published MX products and 8–12 public MX shops, covering at least 4 root categories and 3 states. Record the resulting IDs and counts. |
| Published-listing completeness is not evidenced | Unassigned | Run a production read-only listing audit that records every published listing ID, title, price, condition, seller, location, primary-image path, and successful image-load result. Move incomplete listings to draft through the existing workflow; do not delete them. |
| Duplicate/unrelated primary images are not evidenced | Unassigned | Compare the production primary-image set and visually review every duplicate path; replace or draft any unrelated reuse, recording listing IDs. |
| Copy quality is not evidenced | Unassigned | Review and normalize production-visible titles, seller biographies, condition descriptions, and location names while retaining their factual meaning. |
| Desktop/mobile merchandising mix is not evidenced | Unassigned | After the production inventory audit, review the first catalog rows at 1440 px and 390 px and record the category/shop sequence and screenshots. |

## Production evidence limits

This assessment did not connect to or inspect production Supabase data, production Storage, production browser sessions, publish/draft state, external tickets, or user data. Local schema constraints and catalog code describe intended behavior only; they do not prove that production content meets it. A pre-existing local landing-page audit was not accepted as gate proof because it is not a production, listing-by-listing record and does not supply the required production IDs, image-load evidence, or corrections/owners. Therefore the gate must remain blocked until every production requirement above is directly evidenced.
