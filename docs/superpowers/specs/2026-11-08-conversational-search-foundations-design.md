# Search foundations for future conversational AI

Status: proposed; implementation awaits user review.

## Intent and confirmed requirements

Buyers should eventually be able to use a hybrid conversational search UI. The
example is “waterproof jacket under $100”, followed by refinements in conversation.
AI integration is future work. Before AI connects, the user wants “the best result
possible with traditional search”.

This change prepares and improves the actual catalog search path. It must leave a
single validated representation of search criteria that a future chat interface
and model can reuse. Existing product records remain the source of truth.

## Existing implementation

- `components/catalog/search-bar.tsx` submits text, category, location and locale.
- `lib/queries/catalog.ts` normalizes search parameters and truncates text at 80
  characters. It has no price, condition or attribute filter contract.
- `lib/queries/catalog.server.ts` calls `search_product_ids`, loads real products,
  preserves ranking and falls back to product-name matching on RPC failure.
- The latest public search RPC in
  `20260829055734_shop_publication_moderation.sql` applies publication, moderation,
  shop approval and expiry rules before the final result limit. Its private
  candidate function contains the lexical retrieval and ranking.
- Products carry MXN prices, condition, stock and optional approved translations.
  They have no structured waterproofing, color, size or material fields.
- Existing buyer/seller messages concern shops and orders; those conversations
  are separate from a future search conversation.

The earlier categories/search specification deliberately deferred AI and vector
indexing. This specification advances traditional search and its integration
boundary; it does not activate that earlier hybrid-retrieval proposal.

## Proposed first-release scope

These are recommended implementation decisions, not additional user requirements.

### 1. One search criteria contract

Use existing TypeScript, Zod, Next.js and Supabase stack. Extend the catalog search
contract rather than introducing a parallel search service or AI dependency.

Validated criteria cover text, category/subcategory, administrative area, country,
locale, price lower/upper bounds, currency, new/used condition, used-condition grade,
in-stock requirement, and supported structured attributes. Optional criteria remain
optional so existing callers and links continue to work.

Represent price bounds with explicit inclusive/exclusive semantics: “under 100”
means strictly below 100; “up to 100” includes 100. Validate finite nonnegative
amounts, at most two decimal places, bounded input sizes and consistent ranges.
Compare against the stored decimal MXN price and explicitly match currency.
A used-condition grade implies used condition. Pairing a grade with new condition
is invalid. In-stock means `units_available > 0`; ordinary browsing includes
sold-out listings. Strictly validate criteria from every client, including direct
RPC callers. Reject conflicting duplicate filter parameters. Unrelated route
parameters such as campaign tags or product-page notices are outside the criteria.

Keep original user text separate from executable lexical text. Validation of
interpreted/model criteria must be strict, unlike forgiving legacy URL handling.
Malformed new filter URLs produce an explicit invalid-search state with no
unfiltered product results. Existing category/location reset behavior stays intact.

Allow enough input for a shopping request (proposed limit: 500 characters). Bound
both application and database input; never silently truncate a supported request
so its final constraints disappear. Reject an over-limit request with a correction
message before retrieval. Search and telemetry have separate limits below.

### 2. Conservative deterministic interpretation

Add a pure, tested interpreter for common Spanish and English shopping phrases.
It emits validated criteria, interpretation metadata and any unresolved request.
This uses explicit rules and a small controlled bilingual vocabulary; no model
calls, automatic translation service or inference from interface language.

Initial recognized phrases include explicit price bounds, new/used condition,
supported attribute values and stock availability. Category and location can
continue to come from existing selectors/URL state; automatic extraction of
arbitrary places or categories is deferred. Remaining words become lexical text.

Price parsing handles examples such as “under $100”, “menos de 100 pesos”,
“hasta 100 MXN” and “over 50 pesos”. Parse only unambiguous supported numeric
formats. Never remove a phrase unless it was fully recognized and validated.
Unsupported or ambiguous budget syntax produces an explanatory invalid-search
state and no product results until corrected. This is the proposed default for
this release; it must not claim that a budget was applied. Mere numbers in an
ordinary product name are not budget syntax and remain lexical search terms.
Recognize bounds only in a price context. Preserve “Under Armour” and “New Balance
574” as lexical names. Respect quoted phrases, negation and alternatives before
extracting attributes: “not waterproof” must never set waterproof to yes, and
“black or blue” must never silently select one color. If an explicit constraint
cannot be represented, show the correction state. Ordinary unmatched words stay
searchable.

MXN is the visible catalog default for bare `$` in the current Mexico market,
regardless of Spanish/English wording. Explicit USD requests are unsupported in
this release and produce an explanatory state rather than an invented conversion.
Current product write paths and `price_mxn` remain MXN-only.

A fresh search submission uses `q` for buyer text and carries the currently
selected category and location. Interpret it once. When explicit filters and the
sentence specify compatible constraints, intersect them. An empty intersection
needs correction. Preserve the original text for the initial response.

For share/navigation URLs, use a separate parameter (proposed `texto`) for
literal lexical text, plus explicit validated filter parameters. Parse this form
directly into criteria. Reject a URL supplying both text representations. Links
with legacy `q` still work. This distinction prevents quoted names or residual
keywords from becoming new filters on reload. A filter-only URL is valid.

A subsequent refinement operates on those criteria. Changing an upper bound from
100 to 80 replaces the bound, preserves other criteria, and serializes the new
state. Historical messages have no authority over the current budget.

### 3. Trustworthy structured product details

Add optional, controlled product attributes for color, size, material and
waterproofing, authored through existing seller product create/edit flow. Keep
draft saving, ownership checks and publication requirements intact. Existing
products need no guessed backfill and gain no new publication blocker.

Use a small bounded attribute schema, validated on the server and in the database.
Storage representation is left to the builder, with an additive migration and no
new taxonomy management system. Stable canonical attribute values are independent
of display language; unknown values are not silently normalized to known ones.
Constrain list sizes and text lengths, document supported values, and accept only
attributes that this release can search consistently.

Waterproofing has three states: explicitly yes, explicitly no, and unknown.
Only explicit yes satisfies a waterproof filter. Description text, product images
and AI guesses never turn unknown into yes. Seller claims remain seller claims,
not certifications. Other attributes likewise filter only on declared values.
At rollout, some relevant older listings will lack these fields. On an empty
waterproof search, offer to remove that one filter and keep the product term,
budget and location. Clearly label the broader search. A buyer can then inspect
seller descriptions. Each listing describes one item or configuration: avoid
combining independently listed sizes and colors into an unverified variant.

For the example request, “waterproof” becomes an explicit attribute requirement;
“jacket” remains lexical intent. Include a small documented synonym mapping for
the example (`jacket`, `chamarra`, `chaqueta`) so English requests can retrieve
Spanish listings without requiring a manually added English translation. Do not
expand into a general multilingual ontology in this release.

### 4. One retrieval path with hard guarantees

Extend ranked database retrieval and application fallback to accept the same
criteria. Apply all hard constraints, including stock when requested, before
ranking limits. Current moderation, shop approval, publication, expiry, category
and market rules stay authoritative for anonymous visitors and signed-in owners.

Preserve exact/name-prefix preference and use full-text relevance for remaining
terms and controlled synonym groups. Synonyms within one concept are alternatives;
multiple concepts remain conjunctive. Never loosen price, attributes or market
because there are no results. Expand a jacket synonym only in lexical retrieval,
after parsing, so expanded words never change a price or attribute constraint.
Keep literal name matches ahead of description-only synonym matches, with stable
ordering for ties. Use approved translations in public search.

Database failures may degrade ranking/lexical coverage, but fallback must enforce
all hard filters. If a filter cannot be enforced safely, report search unavailable
instead of returning broader matches. Existing unfiltered browsing remains intact.
No arbitrary model-authored SQL, raw filter operators or privileged AI database
client is introduced.

Account for two reads beyond the ranked RPC in `lib/queries/catalog.server.ts`.
The product-card read fetches current records by ID. Recheck mutable hard filters
there, or return matching card fields in the same database snapshot. A jacket
repriced above budget between reads must not be displayed. The category founder
promotion can prepend products from a separate query. Reserve that promotion for
ordinary category browsing, or apply every active constraint to its candidates
before their limit. Count results and record click positions from the final grid.

Continue returning real product IDs and loading current catalog records. The
builder must choose necessary indexes from actual filter/query shape, not add
speculative vector indexes. Preserve old RPC signatures through an adapter or
additive entry point during rollout; compatibility must be covered by tests.

### 5. Buyer-visible behavior and future conversation boundary

Keep existing search box and result grid as current buyer experience. Show which
recognized constraints were applied, including currency, and explain invalid or
unsupported interpretation. Retain constraints across category/location links,
refresh, sharing and return from product pages. Existing filter reset remains
available. A fresh submission replaces the previous sentence-derived criteria.
Changing a category or state preserves other active criteria. Removing one
criterion or changing a bound must also update the form so submitting again
cannot restore a removed value.

Use a small pure criteria-refinement operation: a refinement sets selected fields,
explicitly clears selected fields, or starts a fresh search; omitted fields retain
their prior values. Validate the resulting whole state. Tests cover preserving a
budget while changing color and explicitly clearing a prior criterion. This is
usable by future chat without storing chats or exposing a new endpoint today.

A future model will produce this criteria/refinement structure. It will not own
retrieval or product facts. Future chat transport, streaming, transcript storage,
assistant copy and visual layout require their own feature design. This release
does not ship a chat toggle, fake assistant responses or conversation persistence.

### 6. Telemetry and rollout

Today both `record_catalog_search` and the `search_events.normalized_query`
column require 1–200 characters. Proposed 500-character searches and filter-only
requests must work independently of event creation. For the existing RPC, send
only eligible normalized lexical text or the existing category slug and skip
the event when neither fits. Do not substitute the original shopping sentence.
A missing event ID disables click recording for that search. If adding structured
event fields, allowlist bounded filter values and share the existing quota
across callers. Do not send transcript text to analytics.

Route filter-only searches to the catalog on `/` or `/estado/[slug]`.
`/explorar` currently reads only locale and market. Keep it as the destination
for an unfiltered catalog. Update the bare-home check, state redirects, and
metadata on both home and state routes. Filtered variants receive noindex while
existing indexable category and state pages retain their metadata.

Product cards currently copy only the query-string portion of the catalog URL.
Pass the validated state slug alongside criteria on product links, then rebuild
the catalog URL from those values on the product page. Use the same serialization
for category navigation and form state.

Ship additive schema changes with database validation and rollback guidance.
Do not apply migrations to a hosted project or deploy as part of this task.

## Explicitly deferred

- AI provider/model selection, credentials, SDKs and model calls.
- Embeddings, vector columns, queues, indexing workers and reciprocal rank fusion.
- Chat UI, streaming and server-stored search conversations.
- Currency conversion, USD inventory and a price-column migration.
- Full category-specific attribute taxonomy, variant inventory and attribute
  inference from descriptions or images.
- General natural-language understanding, arbitrary follow-up text parsing and
  automatic translation. Future AI can address these through validated criteria.

## Acceptance and verification

1. Existing plain searches, category/location navigation, public visibility rules,
   product editing, incomplete drafts and publication behavior still work.
2. Fixtures include Spanish and English jacket listings, expensive matches,
   unpublished/expired/disabled products, unapproved shops, unknown/false
   waterproofing and out-of-stock inventory.
3. “waterproof jacket under $100” returns relevant declared-waterproof jackets
   below 100 MXN; a 100-MXN item is excluded. “up to $100” includes it.
4. Spanish equivalents produce equivalent criteria; English jacket synonyms can
   retrieve Spanish listings. Ordinary titles containing numbers remain useful.
5. Explicit unsupported currency, malformed/contradictory filters and ambiguous
   budget syntax produce an invalid-search state with no product results.
6. More than 24 high-ranking ineligible matches cannot crowd eligible results out
   before the limit. Both ranked and fallback paths honor every hard constraint.
7. Attribute writes enforce ownership and database validation. Unknown attributes
   remain unknown; existing rows and draft saving work without backfill.
8. URLs survive refresh/category/location navigation; filter-only requests render
   catalog results, not seller landing. Invalid criteria have an explicit state.
9. Refinement tests prove set/clear/reset semantics, retained constraints and
   whole-state revalidation, including changing an earlier budget from 100 to 80
   without reparsing the original sentence. No AI dependency is needed.
10. For a category plus budget with no lexical terms, an over-budget founder
    product stays out of the grid. When a ranked listing changes price before
    cards load, the displayed price still satisfies the requested bound.
11. Round-trip a state + budget search through a product card and its catalog
    return link. Assert the same state, criteria, and filtered route metadata.
12. Check relevance with a small fixed bilingual catalog. Compare ordered IDs
    for a literal jacket title, an approved translation, a description-only
    synonym, and an unrelated item. Run “New Balance 574”, “Under Armour”, a
    quoted phrase and a negated attribute to catch unintended filter extraction.
13. Exercise a valid 201–500 character request and a price-only request without
    a category. Search still works when telemetry is skipped. A 501-character
    request ending in a budget produces the correction state.
14. Run focused Vitest tests and database tests, then typecheck, lint and build.
    Run browser coverage for affected buyer/seller flows when environment permits.
    Report any unavailable database/browser verification explicitly.

## Review boundary

User review should confirm this traditional-search-first scope. A later AI/chat
feature will plug into these tested criteria and retrieval boundaries. The builder
may settle file organization, minimal index choices and exact internal storage
details while preserving the behavior and constraints above.
