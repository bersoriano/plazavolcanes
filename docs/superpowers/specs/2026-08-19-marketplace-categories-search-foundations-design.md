# Marketplace Categories and Search Foundations — Design Specification

## Objective

Help buyers find relevant listings quickly through a platform-curated category hierarchy and improved text search. Give sellers a clear classification flow without allowing public taxonomy fragmentation. Prepare data boundaries for United States expansion, Spanish and English content, services, restaurants, and future hybrid AI search without adding LLM calls or vector embeddings now.

This release remains a product catalog. It does not add carts, checkout, payments, orders, service booking, restaurant menus, automatic translation, semantic search, recommendations, or a taxonomy administration UI.

## Approved Product Decisions

- Categories are created and maintained by the platform.
- Buyer-facing taxonomy has two visible levels: main category and leaf subcategory.
- Every published product references one active product leaf category.
- Drafts may remain uncategorized.
- Sellers may suggest missing categories; suggestions never publish automatically.
- Buyer UI exposes product categories only in this phase.
- Services and restaurants remain inactive domains supported by architecture, not unfinished UI.
- Spanish is the initial interface language.
- Category labels and aliases ship in `es-MX` and `en-US`.
- Sellers may add optional manual English product content; AI-assisted translation may be added later as an editable draft.
- Country, language, and currency are independent concepts.

## Domain Boundaries

Marketplace ultimately supports three listing domains:

- `product`: shop-owned physical or digital goods with price, condition, and catalog discovery.
- `service`: future provider offerings with duration, availability, contact, and booking behavior.
- `restaurant`: future venues and menus with cuisine, hours, reservation, ordering, or contact behavior.

Each domain retains its own table and customer action. Categories may use a common taxonomy system, scoped by listing type, but product, service, and restaurant data must not be forced into one polymorphic listing table.

Future mall navigation may expose `Productos`, `Servicios`, and `Comida` as top-level experiences. Current navigation exposes only products.

## Geographic and Localization Architecture

### Markets

- Countries use ISO 3166-1 alpha-2 codes such as `MX` and `US`.
- Administrative areas belong to a country and use stable country-specific codes.
- Mexico remains enabled now; United States may be enabled without changing category identity.
- City or town support may later reference both country and administrative area.
- Country never determines interface or content language.

### Currency

- Product prices carry an ISO 4217 currency code.
- Existing prices remain `MXN`.
- United States products may later use `USD`.
- Search and display must never infer currency solely from interface language.

### Locales and translations

- Locales use BCP 47 tags such as `es-MX` and `en-US`.
- Category identity and slug remain language-neutral.
- Category display names, optional descriptions, and search aliases are localized records.
- Product records store original content language.
- Optional product translations store localized name and description separately from source content.
- Missing translation falls back to original content.
- Future AI translations carry explicit generation source and review status and never publish silently.

Avoid per-language columns such as `name_es` and `name_en`; adding a language must not require altering core category or product tables.

## Data Model

Exact types should follow existing repository conventions and Supabase Postgres best practices.

### `categories`

- Stable primary key.
- `parent_id`: nullable self-reference; null for main categories.
- `listing_type`: constrained domain value, initially `product`.
- `slug`: stable URL-safe identifier, unique within listing type.
- `sort_order`: platform-controlled display order.
- `is_active`: controls selection and buyer navigation.
- Created and updated timestamps.

Only two visible levels are allowed. A selectable product category must be an active leaf whose parent is an active product main category.

### `category_translations`

- Category foreign key.
- BCP 47 locale.
- Localized display name.
- Optional localized description.
- Unique category-locale pair.

### `category_aliases`

- Category foreign key.
- BCP 47 locale.
- Normalized alternate search term.
- Examples: `celular`, `smartphone`, and `móvil` may point to the same leaf.
- Duplicate aliases for the same category and locale are rejected.

### `category_suggestions`

- Authenticated seller foreign key.
- Suggested name.
- Optional context or explanation.
- Optional current main-category reference.
- Locale.
- Review status constrained to `pending`, `approved`, or `rejected`.
- Created and reviewed timestamps.

Sellers may create and read their own suggestions. Public users cannot read suggestions. Frontend roles cannot approve, reject, or directly create categories.

### Product changes

- Add nullable `category_id` referencing categories.
- Add explicit `currency_code`, preserving `MXN` for existing data.
- Add original content locale, preserving `es-MX` for existing data.
- A draft may have no category.
- A published product must reference an active product leaf.
- Existing published uncategorized products remain visible under `Todos` during migration and receive an owner prompt to classify them.

### `product_translations`

- Product foreign key.
- BCP 47 locale.
- Localized name and description.
- Translation source constrained for manual content now and future AI-generated drafts.
- Review or publication state capable of preventing unreviewed AI content from becoming public.
- Unique product-locale pair.

Initial UI supports optional seller-authored `en-US` content. Automatic translation remains excluded.

## Authorization

Row-level security remains enabled on all exposed tables.

- Everyone may read active categories, translations, and aliases required for public discovery.
- Category writes remain unavailable to anonymous and authenticated frontend roles.
- Authenticated sellers may create suggestions and read only their own suggestions.
- Product category changes retain existing shop-ownership checks.
- Product publication validation must run server-side and be protected independently by database constraints or an equivalent guarded database operation.
- Translation writes require ownership of the product through its parent shop.

## Buyer Experience

Discovery follows familiar Airbnb-like progressive filtering while retaining Plaza Volcanes visual identity.

- Prominent search remains primary entry point.
- Horizontally scrollable main-category rail appears below search.
- Each main category uses a consistent platform-selected icon and localized label.
- `Todos` clears category selection.
- Selected category uses aubergine text, mint indicator, and non-color state treatment.
- Selecting a main category reveals leaf subcategory chips.
- Search text and category filters combine.
- URL persists discovery state with query parameters such as `q`, `categoria`, and `subcategoria`.
- Back, refresh, and sharing preserve filter state.
- Invalid category slug falls back to `Todos` with a clear notice.
- Empty results preserve current filters and provide a one-action reset.
- Mobile uses touch-friendly horizontal rails rather than a dense sidebar.
- Desktop may later add a compact filter popover for price, condition, and location.

Public shop pages show category navigation only when catalog variety makes it useful. Small catalogs stay visually simple.

## Seller Experience

Product form uses progressive category selection:

1. Seller chooses main category.
2. Seller chooses leaf subcategory.
3. Seller completes existing product fields.
4. Seller may save a draft without a category.
5. Publication blocks until an active product leaf is selected.

`No encuentro mi categoría` opens a short suggestion form. Submission preserves product form state and never interrupts draft creation. A controlled `Otros` leaf may exist under main categories with known gaps; choosing it prompts an optional suggestion so taxonomy quality can improve without blocking publication.

Spanish content remains primary. Optional `Agregar versión en inglés` fields stay collapsed by default. Seller controls English name and description. Missing English content falls back to original Spanish.

If a selected category is later deactivated, existing draft shows it for context but requires reselection before publication.

## Initial Product Taxonomy

All entries receive matching `es-MX` and `en-US` translations and appropriate aliases.

### Electrónica

- Celulares y accesorios
- Computación
- Audio y video
- Videojuegos
- Accesorios electrónicos

### Hogar y jardín

- Muebles
- Decoración
- Cocina y comedor
- Electrodomésticos
- Jardín y herramientas

### Moda y accesorios

- Ropa para mujer
- Ropa para hombre
- Calzado
- Bolsas y accesorios
- Joyería y relojes

### Belleza y cuidado personal

- Maquillaje
- Cuidado de piel
- Cuidado del cabello
- Perfumes
- Cuidado personal

### Alimentos y bebidas

- Despensa
- Panadería y postres
- Bebidas sin alcohol
- Alimentos artesanales

### Deportes y aire libre

- Ejercicio y fitness
- Ciclismo
- Camping
- Artículos deportivos

### Bebés, niñas y niños

- Ropa infantil
- Juguetes
- Cuidado infantil
- Artículos escolares

### Arte, papelería y manualidades

- Arte
- Papelería
- Manualidades
- Instrumentos musicales

### Mascotas

- Alimento
- Accesorios
- Higiene y cuidado

### Automotriz

- Refacciones
- Accesorios
- Herramientas

### Libros, medios y coleccionables

- Libros
- Música y películas
- Coleccionables
- Antigüedades

Alcohol, medication, weapons, and tobacco remain excluded until marketplace policies and compliance controls exist.

## Deterministic Search Foundation

Initial search uses PostgreSQL full-text search and structured filters, not an LLM.

Searchable inputs:

- Product name.
- Product description.
- Category translation and aliases for active locale.
- Shop name.

Normalization handles casing, accents, and whitespace. Locale-aware searchable documents and GIN indexes support Spanish and English. Search returns published products from publicly visible shops only.

Ranking priority:

1. Exact product-name match.
2. Product-name prefix match.
3. Category or alias match.
4. Product-description match.
5. Shop-name match.
6. Freshness as a small tie-breaker.

Category, listing type, condition, price, country, state, and later city remain hard filters. Search should degrade to existing basic product-name matching if full-text execution fails.

## Search Telemetry

Record enough anonymous evidence to improve ranking:

- Normalized query.
- Locale and market.
- Applied filters.
- Result count.
- Selected result ID and position when a result is opened.
- Timestamp.

Do not record email, product-form drafts, personal details, or raw authenticated identity. Apply retention limits before telemetry grows materially.

## Future Hybrid AI Search

Future natural-language search uses LLMs for query understanding, not as marketplace source of truth.

Example query:

> iPhone usado en buen estado por menos de 8 mil en Puebla

Validated interpretation:

- Text query: `iPhone`.
- Listing type: `product`.
- Condition: used, good.
- Maximum price: `8000 MXN`.
- Administrative area: Puebla, Mexico.

Future retrieval pipeline:

1. LLM converts natural language into schema-validated text and filters.
2. Query embedding retrieves semantically similar localized documents.
3. PostgreSQL full-text search retrieves exact keyword matches.
4. Reciprocal Rank Fusion combines both rankings.
5. Hard marketplace rules remove unpublished, unavailable, wrong-market, wrong-category, or wrong-type results.
6. Every result resolves to a real database record.

Future denormalized `search_documents` index should contain entity type, entity ID, locale, searchable content, category path, content hash, embedding, embedding model, model version, indexing status, and timestamps. Embeddings regenerate asynchronously after source changes with retry behavior.

Do not add vector columns now. Embedding dimensions and index operator depend on future model choice. Keyword search remains fallback during model, queue, provider, timeout, or parsing failures. Future AI endpoints require server-only credentials, validation, rate limits, caching, and cost monitoring.

## Accessibility and Visual Behavior

- Category controls use semantic links or buttons with visible labels.
- Selection is communicated through text and state attributes, not color alone.
- Keyboard navigation works across search and category controls.
- Mint focus ring remains clearly visible against cream and white.
- Interactive targets approach or exceed 44 by 44 CSS pixels.
- Normal text maintains WCAG 2.2 AA contrast.
- Horizontal category navigation exposes usable overflow behavior to keyboard and assistive technology.
- Existing aubergine, mint, cream, white, coral, and typography system remains authoritative.

## Failure Handling

- Unknown category URL: fall back to `Todos` and explain reset.
- Deactivated category on draft: show context and require reselection before publication.
- Missing translation: fall back to original language.
- Category suggestion failure: preserve text and allow retry.
- No results: preserve filters and provide reset.
- Full-text failure: fall back to basic product-name search.
- Future AI failure: fall back to deterministic search without blocking discovery.
- Unauthorized taxonomy or translation mutation: reject server-side and through RLS.

## Rollout

1. Add taxonomy, localization, suggestion, and product-translation schema.
2. Seed Spanish and English category translations and aliases.
3. Add nullable product category, currency, and original-locale fields with compatibility defaults.
4. Add deterministic search document and indexes.
5. Deploy buyer category navigation and URL filters.
6. Deploy seller category selection, suggestion flow, and optional English fields.
7. Prompt owners of uncategorized products to classify listings.
8. Monitor zero-result searches, category usage, suggestions, and result selections.

## Verification

- Unit tests cover locale validation, hierarchy rules, category selection, translation fallback, query normalization, and publication validation.
- Database tests cover category read access, taxonomy write denial, suggestion ownership, translation ownership, and cross-shop mutation denial.
- Integration tests cover combined text/category filtering, exact and alias matches, locale selection, invalid slugs, and uncategorized compatibility.
- Browser tests cover buyer navigation, shareable filtered URLs, draft save without category, blocked publication without category, category suggestion, and optional English content.
- Accessibility checks cover semantics, labels, keyboard behavior, focus visibility, target sizes, overflow, and contrast.
- Migration tests confirm existing shops and products remain accessible.
- Final gates remain lint, type-check, tests, and production build.

## Acceptance Criteria

- Buyers browse active product categories and leaf subcategories in Spanish.
- English category translations and aliases exist for future locale activation.
- Text search and category filters combine and persist in shareable URLs.
- Published products require one active product leaf category; drafts do not.
- Sellers can submit private missing-category suggestions.
- Sellers can add optional manual English product name and description.
- Existing uncategorized products remain visible during migration.
- Country, locale, currency, and listing type remain independent in schema and search filters.
- Deterministic search works without LLM or embedding dependencies.
- Data needed for later multilingual hybrid search is structured and versionable.
- Services and restaurants remain absent from current buyer UI and current product flows.
