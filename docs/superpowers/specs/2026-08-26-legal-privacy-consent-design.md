# Legal, merchant identity, privacy, consent and transaction proof

Plaza Volcanes has no terms, no privacy notice, no published policies, no
merchant identity surface, no acceptance evidence and no transaction receipt.
It also ships two claims that nothing backs. This design builds the surfaces,
the evidence trail and the enforcement gates that Mexican consumer and privacy
law require of an e-commerce site, and it does so in a way that refuses to
publish anything a lawyer has not approved.

> **This implementation does not establish legal compliance.** It builds the
> mechanism. Every document ships as `draft` and cannot be published or
> accepted until licensed Mexican consumer and privacy counsel reviews the
> content and the workflows and someone records that approval through the
> publish step. No claim of PROFECO compliance, verification, buyer protection
> or legal compliance appears in any shipped copy.

Sources were fetched from official texts on 2026-08-26, not recalled. The
source log is §11.

## Decisions taken before design

| Question | Decision | Consequence |
|---|---|---|
| Marketplace role | **Pure intermediary, narrow.** The seller is the `proveedor`: sells, is paid, ships, warrants, accepts returns, issues CFDI. Plaza Volcanes publishes listings, hosts messaging, publishes seller identity, forwards complaints, points to PROFECO. | The "arbitraje" promise and the verification badges come down (§3) |
| Relationship to the landed-cost spec | **Absorb the policy schema here.** This work implements `shop_commerce_policies`, `platform_commerce_policy` and the order policy snapshot from `2026-08-26-landed-cost-checkout-design.md`; shipping quoting and `checkout_quotes` stay with that spec. | One source of truth for returns and warranty terms |
| Missing-document behaviour | **Build-time check plus runtime block**, with a checked-in `launch-state.json` escape hatch (§2) | Checkout goes dark on landing until counsel approves and someone publishes |
| Seller gate | **Catalog visible, purchase requests blocked** until the compliance profile is `approved` | Existing catalog stays browsable; no transaction happens without art. 76 BIS III identity |
| Counsel status | **Not engaged.** Documents seed as `draft`, unpublishable, acceptance inert. | The build check fails by design until counsel approves |
| Cookie/analytics notice | **Not required.** No third-party tracking exists (§7). | Recorded as an evidence-backed omission, not an oversight |

## 1. What is already here

Worth knowing before the schema, because the design leans on it and because
some of it is better than the audit implied.

- **No IP address or device fingerprint is collected anywhere.** `search_events`
  stores normalised query, locale, country, category, result count and the
  selected product. No user id, no address. Verified by reading the table
  definition in `20260819173000_add_categories_and_search.sql`.
- **No third-party tracking.** No analytics, pixels, tag managers or
  `next/script` in `app/`, `components/` or `lib/`. `next/font/google` inlines
  fonts at build time, so no runtime request reaches Google. The only cookies
  are Supabase auth cookies, which are strictly necessary.
- **Address retention already runs.** `private.redact_expired_order_addresses`
  nulls every address field 90 days after an order closes, later if a dispute is
  open, on cron `plaza-redact-order-addresses` at 01:15
  (`20260820173553_add_reviews_disputes.sql`).
- **Message retention already runs.** `private.purge_idle_pre_sale_conversations`
  deletes pre-sale threads idle for 180 days on cron `messaging-presale-purge`
  at 03:30 (`20260823100000_message_retention_and_realtime.sql`). Order
  conversations are never purged.
- **Admin reads are audited.** `public.admin_read_events` records admin id,
  conversation and a mandatory reason; `private.admin_audit_events` records
  membership changes and dispute resolutions.
- **A proven security-definer shape exists.** `public.checkout_cart_v2`
  delegates to `private.checkout_cart_internal`: `security definer`,
  `set search_path = ''`, revoked from `public, anon`, granted to
  `authenticated`. Every new definer function copies it.
- **A business-day calendar exists.** `private.add_business_days(started_at,
  days, time_zone)` from `20260820173552`. ARCO deadlines reuse it. There is one
  calendar in this codebase, not two.
- **Idempotency exists.** `orders.idempotency_key`, checked before any write.

## 2. Publication gate

`scripts/legal-verify.mjs` runs before `next build`:

```
"build": "node scripts/legal-verify.mjs && next build"
```

It validates the platform identity config with zod, then asks the database for a
published, effective version of every `is_required` document type. Published
versions are anon-readable, so the publishable key already in the build
environment suffices — no secret is added.

It exits non-zero unless `docs/legal/launch-state.json` declares:

```json
{
  "status": "pre_launch",
  "owner": "<name and role>",
  "reason": "counsel not engaged",
  "acknowledged_unpublished": ["platform_terms", "privacy_notice", "..."],
  "reviewed_on": "2026-08-26"
}
```

The file is checked in and reviewable — a deliberate declaration someone must
edit, not an environment flag that behaves differently where it matters. While
it reads `pre_launch`:

- `/terminos` and its siblings render an explicit configuration notice, marked
  `noindex`, with no placeholder legal text and no acceptance control. Not a
  404, not lorem ipsum.
- `checkout_cart_v3` refuses to create orders, in Spanish, because there is no
  published document to accept. The refusal is in the database, so no client
  path bypasses it.

Setting `"status": "launched"` removes the escape hatch: any unpublished
required type hard-fails the build with no override.

### Platform identity configuration

Razón social, RFC, domicilio, teléfonos, correo, horarios de atención and the
data-protection contact are **deployment facts that do not exist yet**. They are
env vars validated with zod, and `legal-verify` names each missing one. Nothing
in this design invents them.

They are snapshotted into the document version at publish time
(`issuer_identity jsonb`, covered by the content hash) rather than rendered
live. If they rendered live, changing an env var would silently alter a document
whose hash claims immutability. Changing the entity's address therefore requires
a new version — which is the correct outcome, not a limitation.

## 3. Claims that come down

| Where | Current text | Why it must change | Replacement |
|---|---|---|---|
| `lib/trust-markers.ts:82-92` | "Vendedor verificado" / "Altamente verificado — completó una verificación avanzada con documentos oficiales y controles de seguridad adicionales" | `user_trust_profiles.verification_level` defaults `'unverified'` and **nothing in the codebase ever writes it**. No review process exists. LFPC art. 32 requires information to be veraz y comprobable. | `identity_disclosure` derived from `seller_compliance_profiles`: `sin_datos` / `datos_recibidos` / `datos_verificados`, worded to name exactly what was checked and by whom |
| `lib/trust-markers.ts:76-80` | "Verificación básica — verificó su teléfono y correo electrónico" | Email confirmation is **off** (`docs/domain-follow-ups.md` §3) and the phone is self-declared at signup, never verified. The statement is false today. | Same replacement. No shop reaches `datos_verificados` until a reviewer records it. |
| `components/home/trust-strip.tsx:22-26` | "Disputas con arbitraje — abres una disputa y administración revisa la evidencia de ambas partes" | Promises mediation with no published scope, SLA or limit, on a platform that holds no money and cannot compel a refund | Factual description of the internal claims process and its stated limits, linking `/quejas-y-aclaraciones` |
| `components/orders/buyer-trust-card.tsx:107` | Same verification marker, buyer side | Same | Same |

`components/shops/trust-badges.tsx` and `app/tiendas/[slug]/page.tsx:80` consume
the new projection. `user_trust_profiles.verification_level` is left in place but
stops feeding any public claim; retiring the column is follow-up work.

## 4. Schema

### 4.1 Legal content

**`public.legal_documents`** — stable type registry, one row per type.

```
type          text primary key
              -- platform_terms | privacy_notice | buyer_terms | seller_terms
              -- returns_policy | warranty_policy | shipping_policy
              -- complaints_policy | security_guidance | marketplace_role
is_required   boolean not null default true
public_path   text unique              -- '/terminos', null when the type has no route
sort_order    smallint
```

`cookies_notice` is deliberately absent — see §7.

**`public.legal_document_versions`**

```
id                    uuid primary key default gen_random_uuid()
document_type         text not null references legal_documents (type)
version               integer not null
status                text not null check in ('draft','approved','published','retired')
locale                text not null default 'es-MX'
title                 text not null
body                  jsonb not null           -- {"sections":[{id,heading,paragraphs[]}]}
issuer_identity       jsonb                    -- captured at publish
content_hash          text                     -- sha256 over body || issuer_identity
change_summary        text not null
is_material           boolean not null default true
effective_at          timestamptz
published_at          timestamptz
retired_at            timestamptz
approved_by           text                     -- counsel name and capacity, free text on purpose
approved_at           timestamptz
supersedes_version_id uuid references legal_document_versions (id)
created_at            timestamptz not null default now()
unique (document_type, version)
```

`approved_by` is free text rather than a `uuid` because the approver is a
licensed lawyer who may hold no account on this system. Recording "who" matters
more than joining to a row.

`body` is structured `jsonb` rather than Markdown. This repository has no
Markdown parser and this change does not add one; structured sections also give
every heading a stable anchor id, which the "high-impact terms near the action,
with a link to the full document" requirement needs in order to link into a
specific clause.

**Immutability** is a trigger, not a convention. Once `status = 'published'`:
`UPDATE` raises unless the only change is `published → retired` with
`retired_at` set; `DELETE` always raises, at every status, so draft history
survives too.

**Publishing** goes through `public.publish_legal_version(p_version_id, p_issuer_identity)`:
`security definer`, `set search_path = ''`, admin-gated, audited into
`private.admin_audit_events`. It refuses unless the row is `approved` and
`approved_by`, `approved_at` and `effective_at` are all present; it captures
`issuer_identity` from validated config, computes `content_hash`, sets
`published_at`, and points `supersedes_version_id` at the outgoing version.

**Resolution.** `public.current_legal_document(p_type text)` returns the
published version with the greatest `effective_at <= now()`.

### 4.2 Consent

**`public.legal_acceptances`** — immutable.

```
id                  uuid primary key default gen_random_uuid()
user_id             uuid not null references auth.users (id) on delete restrict
document_type       text not null references legal_documents (type)
document_version_id uuid not null references legal_document_versions (id)
content_hash        text not null            -- copied at insert
accepted_at         timestamptz not null default now()
surface             text not null check in ('registro','checkout','alta_tienda','panel')
action              text not null            -- the button label actually pressed
order_id            bigint references orders (id)
shop_id             bigint references shops (id)
```

`on delete restrict` on `user_id` is deliberate: acceptance evidence must
survive an account deletion request, which LFPDPPP art. 25 fr. I and II permit.
Anonymisation replaces the id with a stable pseudonym rather than deleting the
row (§6.3).

`UPDATE` and `DELETE` raise, unconditionally.

**Forgery is prevented by absence.** `public.record_acceptances(p_types text[],
p_surface text, p_action text, ...)` accepts no version id and no hash from the
client. It resolves the current published version itself and writes the hash
from the database row. There is no parameter for a crafted version to arrive in.

**`public.consent_preferences`** — optional, revocable.

```
user_id      uuid references auth.users (id) on delete restrict
consent_type text check in ('marketing_email','data_sharing')
granted      boolean not null
changed_at   timestamptz not null default now()
source       text not null
primary key (user_id, consent_type)
```

Plus append-only `public.consent_preference_events` with the same columns and an
`id`, also `on delete restrict`: a withdrawal record is evidence and must
survive the way an acceptance does, so both are pseudonymised by anonymisation
rather than deleted. **No row means not granted**, so "defaults unchecked" is the schema's
resting state, not a prop somebody might forget. Nothing in the purchase path
reads this table, so refusing marketing cannot block a purchase.

**`public.age_attestations`**

```
user_id          uuid primary key references auth.users (id) on delete cascade
attested_at      timestamptz not null default now()
surface          text not null
terms_version_id uuid not null references legal_document_versions (id)
```

Self-attestation of 18+ (Código Civil Federal art. 646). **No birth date is
collected**, per LFPDPPP art. 12's minimisation duty. The restriction is
explained before the registration form, not after it.

**Re-acceptance.** `public.pending_acceptances(p_user uuid)` returns types whose
current published version postdates the user's latest acceptance **and** where
some intervening version carries `is_material = true`. A typo fix does not
re-prompt the whole user base.

### 4.3 Seller compliance identity

**`public.seller_compliance_profiles`** — one row per shop.

```
shop_id                bigint primary key references shops (id) on delete cascade
person_type            text check in ('fisica','moral')
legal_name             text            -- nombre completo o razón social
commercial_name        text
rfc                    text            -- format check by person_type: 13 / 12 chars
service_address        jsonb           -- domicilio para reclamaciones (LFPC 76 BIS III, 78)
business_email         text
business_phone         text
attention_hours        text            -- Código de Ética art. 6
invoicing_available     boolean
invoicing_instructions text
representative_name    text            -- personas morales
verification_status    text check in ('sin_datos','datos_recibidos','en_revision',
                                      'approved','rejected','reverification_required')
verified_at            timestamptz
reviewed_by            uuid references auth.users (id)
rejection_reason       text
created_at, updated_at timestamptz
```

The privacy split is structural, not a `select` list somebody has to remember:

- The table grants `select` **only to the owner** —
  `(select auth.uid()) = shops.owner_id` — plus admins. `anon` is granted
  nothing, so the PostgREST Data API cannot leak it however it is queried.
- Public surfaces read **`public.shop_merchant_projection`**, a
  `security invoker` view whose column list contains commercial name, person
  type, state, platform contact channel and `identity_disclosure` state.
  **RFC, service address, representative name and any verification file
  reference are absent from the view — not filtered, absent.**
- `identity_disclosure` is derived in the view, not stored: `sin_datos` when
  `verification_status` is `sin_datos` or null; `datos_recibidos` for
  `datos_recibidos`, `en_revision` and `reverification_required`;
  `datos_verificados` only for `approved`. `rejected` maps to `sin_datos` —
  a rejection is not a public accusation.
- Seller UI masks RFC and address on display (`RFC ****ABC`); revealing writes
  an access log row.
- An `UPDATE` to any identity-bearing column while `verification_status =
  'approved'` fires a trigger resetting status to `reverification_required` and
  recording the reason.

Verification documents are **out of scope for this change**. No file upload for
identity documents ships until counsel decides what may be collected and for how
long; the schema reserves nothing that would tempt an interim implementation.

### 4.4 Order snapshot

Additive on `public.orders`, on top of the landed-cost columns:

```
seller_identity_snapshot   jsonb        -- the exact merchant identity displayed
platform_terms_version_id  uuid
buyer_terms_version_id     uuid
returns_policy_version_id  uuid
warranty_policy_version_id uuid
marketplace_role_version_id uuid
privacy_notice_version_id  uuid
acceptance_batch_id        uuid
transaction_reference      text unique  -- 'PV-' || base32(10 random bytes)
```

`transaction_reference` is the public receipt key. The serial `id` never appears
in a shareable URL.

### 4.5 Complaints

**`public.support_cases`**

```
id, reference text unique,
user_id  uuid not null references auth.users (id) on delete restrict,
category, order_id, shop_id,
subject, description,
status check in ('recibido','en_revision','esperando_vendedor','resuelto','cerrado'),
assigned_admin_id, resolution_notes,
created_at, updated_at, resolved_at
```

Categories: `pregunta_producto`, `queja_vendedor`, `queja_plataforma`, `arco`,
`disputa_pedido`, `fraude_seguridad`. `arco` routes into `privacy_requests`;
`disputa_pedido` routes into the existing `order_disputes` flow rather than
forking a second dispute system.

**`public.support_case_evidence`** references objects in a **private** Storage
bucket `reclamaciones` at `{user_id}/{case_id}/{uuid}`. MIME and size validated
server-side against the limits already in `lib/storage.ts`. Signed URLs only.
`storage.objects` policies restrict to owner and admin.

### 4.6 ARCO

**`public.privacy_requests`**

```
id, reference text unique, user_id,
request_type check in ('acceso','rectificacion','cancelacion','oposicion'),
description, requested_changes jsonb,
status check in ('recibida','identidad_pendiente','en_tramite','prevenida',
                 'respondida','ejecutada','negada'),
identity_verified_at, identity_verified_by,
response_due_at,          -- +20 días hábiles from created_at (art. 31)
responded_at,
effective_due_at,         -- +15 días hábiles from responded_at (art. 31)
extension_granted_at,     -- one only (art. 31)
denial_ground text,       -- names the art. 33 fracción
outcome_evidence jsonb,
legal_hold boolean not null default false, legal_hold_reason text,
created_at, updated_at
```

Deadlines computed with `private.add_business_days`, because LFPDPPP art. 2
fr. VIII defines "Días" as días hábiles.

### 4.7 Indexes

```
legal_acceptances (user_id, document_type, accepted_at desc)
legal_document_versions (document_type, effective_at desc) where status = 'published'
privacy_requests (user_id, status)
privacy_requests (status, effective_due_at)          -- admin queue
seller_compliance_profiles (verification_status)
orders (transaction_reference)                        -- unique
support_cases (reference)                             -- unique
support_cases (user_id, created_at desc)
support_cases (status, created_at)                    -- admin queue
```

### 4.8 Security posture

RLS on every new table. `anon` is granted nothing beyond published legal
documents and `shop_merchant_projection`. Ownership policies use
`(select auth.uid())`. Every `UPDATE` policy carries both `USING` and
`WITH CHECK`. Functions are `security invoker` unless they must not be; the
definers live in `private` with `set search_path = ''`, `revoke ... from public,
anon`, a narrow `grant execute`, and an explicit `public.is_current_user_admin()`
check — the shape `checkout_cart_v2` already proves here.

## 5. Routes

| Route | Access | Content |
|---|---|---|
| `/terminos` | public | Platform terms |
| `/privacidad` | public | Privacy notice, integral. Simplified notice rendered at every collection point (LFPDPPP art. 16 fr. II) |
| `/compras-y-devoluciones` | public | Returns, replacements, exchanges, cancellations |
| `/garantias` | public | Warranty policy |
| `/envios` | public | Shipping and delivery |
| `/seguridad` | public | Security and fraud guidance |
| `/quejas-y-aclaraciones` | public | Complaints channel, hours, platform limits, PROFECO route; authenticated form below |
| `/terminos-vendedores` | public | Seller terms |
| `/comprobantes/[reference]` | buyer or shop owner | Transaction receipt |
| `/panel/cumplimiento` | shop owner | Seller compliance profile |
| `/cuenta/privacidad` | authenticated | Data view, correction, ARCO submission and tracking |
| `/admin/privacidad` | admin | ARCO review queue |
| `/admin/reclamaciones` | admin | Support case queue |

Footer gains a persistent legal column with all eight public policy links.
Sitemap gains the eight public policy routes; `/comprobantes/`,
`/cuenta/privacidad` and the admin routes are added to `PRIVATE_PATHS` in
`app/robots.ts`. Pages are server-rendered, printable, readable at 390 px, and
reachable before registration or checkout.

## 6. Workflows

### 6.1 Checkout

Acceptance and order creation are one transaction.
`checkout_cart_v3(p_quote_id, p_buyer_note, p_idempotency_key,
p_displayed_types text[])` writes acceptances, order, snapshot and events
together, idempotent on `p_idempotency_key`.

The disclosure block above the button carries, in order: seller commercial name,
person type, **domicilio de reclamaciones, teléfono, correo, horarios de
atención**; item description and condition; quantity; **monto total a pagar in
MXN, itemised**; shipping method, cost and estimated window; the payment model
stated as *"El pago se acuerda directamente con el vendedor. Plaza Volcanes no
cobra ni retiene el pago."*; returns and warranty summaries from
`shop_commerce_policies`; the complaint channel; the marketplace-role
disclosure; and a link to each full policy.

That ordering covers all eight PROFECO Monitoreo criteria in one view, which is
what gets scored.

One required checkbox, unchecked, **listing each document with its own link** —
never one blob. High-impact terms render inline; accordions may summarise but
never hide. The button reads "Enviar solicitud de compra", the action it
performs.

### 6.2 Receipt

`/comprobantes/[reference]` renders from snapshot columns and `order_events`
only. **No join to live `shops`, `products` or policy tables**, so a later seller
edit cannot alter an issued receipt — a property of the query, not of
discipline.

The route key is unguessable **and** the read is authorised to buyer or shop
owner. Enumeration fails twice.

Printable HTML with `@media print`. **No PDF library is added.** `package.json`
carries no document tooling and this task does not introduce a dependency for
it; browser print-to-PDF is the honest answer and the page says so. Email
delivery is stubbed behind the SMTP work tracked in `docs/domain-follow-ups.md`
§3 — wired, documented, not claimed as working.

### 6.3 Deletion and anonymisation

Cancellation honours LFPDPPP arts. 24 and 25.
`private.evaluate_cancellation_eligibility(p_user uuid)` returns the blocking
reasons — active orders, open disputes, open support cases, records inside a
retention window — and **bloqueo** applies rather than erasure. The UI names the
reasons in Spanish rather than silently refusing.

After the block period, `private.anonymize_user(p_user uuid)`:

- nulls `user_contact_details`, `user_display_names`
- redacts `order_addresses` through the shape the existing cron already uses
- tombstones message bodies, keeping thread structure for the counterparty's
  evidence
- keeps `legal_acceptances` under a stable pseudonymous id, because that record
  is precisely what art. 25 fr. I and II preserve

**Session revocation cannot happen in SQL.** It runs in the admin action path
against the Supabase Auth admin API with the service role, **before** the row
work, and is tested there. This is an operational requirement, not a trigger.

### 6.4 Automated evaluation

`buyer_trust_evaluations` and `shop_trust_evaluations` produce tiers that change
`free_listing_limit` and public standing without human intervention. That is an
automated evaluation with a significant effect, so **LFPDPPP art. 26 fr. II
gives the person a right to oppose it**. The privacy notice describes it, and
`oposicion` requests against trust evaluation are a first-class path in the ARCO
queue rather than an afterthought.

This was not in the original brief. It surfaced while inventorying the data and
is the single most likely privacy finding a reviewer would raise.

## 7. Compliance matrix

Consultation date for every row: **2026-08-26**. `Type` is B = binding law,
V = voluntary code, G = guidance, I = internal policy.

| # | Requirement | Source | Article | Type | Applies to | Product location | Stored evidence | Owner | Review | Test |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Provider must show domicilio físico, teléfonos and reclamation channels **before** the transaction | S1 | 76 BIS fr. III | B | Seller (platform publishes) | Checkout disclosure, product page, `/quejas-y-aclaraciones` | `orders.seller_identity_snapshot` | Product | Pending counsel | pgTAP 22, comp. 27 |
| 2 | Total amount payable shown notoriously, including every charge | S1 | 7 BIS | B | Seller | Checkout summary, order, receipt | `orders.total` + snapshot | Product | Pending counsel | comp. 27 |
| 3 | Consumer may know terms, conditions, costs, additional charges, payment methods | S1 | 76 BIS fr. V | B | Both | Checkout disclosure | Acceptance row + snapshot | Product | Pending counsel | comp. 27 |
| 4 | Confidential use of consumer information; no transfer to providers outside the transaction | S1 | 76 BIS fr. I | B | Both | RLS; privacy notice | Policy definitions | Eng | Pending counsel | pgTAP 12, 13 |
| 5 | Inform the general characteristics of the security elements used, before the transaction | S1 | 76 BIS fr. II | B | Platform | `/seguridad`, checkout link | Published doc version | Eng + counsel | **Not drafted** | pgTAP 1 |
| 6 | Respect the decision not to receive commercial notices | S1 | 76 BIS fr. VI *(reformada DOF 12-12-2025)*, 18, 18 BIS | B | Both | `consent_preferences` | Preference + event history | Product | Pending counsel | comp. 7, 8, 9 |
| 7 | No marketing strategies aimed at vulnerable populations without warning mechanisms | S1 | 76 BIS fr. VII *(reformada DOF 12-12-2025)*, 1 fr. X | B | Both | Age attestation, product warnings | `age_attestations` | Product + counsel | **Open question Q6** | comp. 33 |
| 8 | Recurring charges need express informed consent; renewal notice 5 días naturales; immediate cancellation | S1 | 76 BIS fr. VIII, IX *(adicionadas DOF 12-12-2025)* | B | Seller | **Not applicable today** — no recurring charges exist | n/a | Product | N/A, recorded | — |
| 9 | Information and advertising must be veraz, comprobable, clara; no engañosa or abusiva | S1 | 32 | B | Both | §3 claim removal | Removed copy in git history | Product + counsel | **Actioned by this change** | comp. C1 |
| 10 | Offered warranty ≥ 90 days from delivery | S1 | 77 | B | Seller | `/garantias`, `shop_commerce_policies` constraint | Policy version snapshot | Product + counsel | Pending counsel | pgTAP 16 |
| 11 | Póliza de garantía in writing: alcance, duración, condiciones, mecanismos, **domicilio para reclamaciones**, talleres | S1 | 78 | B | Seller | Receipt warranty block | `orders.warranty_policy_version_id` | Product + counsel | Pending counsel | pgTAP 24, 26 |
| 12 | Warranties may not reduce the consumer's legal rights | S1 | 79 | B | Seller | Policy floor validation | Constraint | Counsel | **Open question Q4** | pgTAP 16 |
| 13 | Reposición or devolución plus bonificación in the listed cases | S1 | 92 | B | Seller | `/compras-y-devoluciones` | Published doc version | Counsel | **Not drafted** | pgTAP 1 |
| 14 | Revocación de consentimiento within 5 días hábiles | S1 | 56 | B | Seller | `/compras-y-devoluciones` | Published doc version | Counsel | **Open question Q3** — scope in e-commerce | pgTAP 1 |
| 15 | Complaint before PROFECO requires the provider's name and domicilio from the receipt | S1 | 99 | B | Platform enables | Receipt, `/quejas-y-aclaraciones` | `seller_identity_snapshot` | Product | Pending counsel | pgTAP 24 |
| 16 | E-commerce guided by the NMX: transaction proof, acceptance mechanisms, complaint mechanisms, identity/payment/delivery | S1, S5 | 76 BIS 1 fr. II, III, IV, V, VI, VII | B (via reference) | Both | Receipt, acceptance checkbox, complaint route | Acceptances, receipt | Product | **Open question Q5** — full NMX text not obtained | pgTAP 23, 24 |
| 17 | Aviso de privacidad minimum content | S2 | 15 fr. I–VI | B | Platform (responsable) | `/privacidad` | Published doc version | Counsel | **Not drafted** | pgTAP 1 |
| 18 | Electronic collection requires a **simplified** notice carrying art. 15 fr. I–IV plus a link to the integral | S2 | 16 fr. II | B | Platform | Registration, checkout, complaint and ARCO forms | Published doc version | Eng + counsel | Pending counsel | comp. 31 |
| 19 | Sensitive data requires express written consent | S2 | 8 | B | Platform | **None collected.** Design collects no sensitive category | n/a | Counsel | Confirm at review | pgTAP 13 |
| 20 | Treatment limited to notice purposes; new purpose ⇒ new consent | S2 | 11, 12 | B | Platform | Purpose register in `/privacidad` | Published doc version | Eng | Pending counsel | — |
| 21 | Suppression after purpose ends, previous bloqueo; 72 months for contractual breach data | S2 | 10 | B | Platform | Retention map §8 | Cron functions | Eng + counsel | **Open question Q7** | pgTAP 18, 19 |
| 22 | Administrative, technical and physical security measures | S2 | 18 | B | Platform | RLS, private schema, signed URLs | Migration + advisors | Eng | Pending counsel | advisors |
| 23 | Significant breaches reported to the person **immediately** | S2 | 19 | B | Platform | Incident-response runbook §9 | Runbook | Eng + counsel | **Not drafted** | — |
| 24 | ARCO rights exercisable; no right is a precondition for another | S2 | 21–26 | B | Platform | `/cuenta/privacidad` | `privacy_requests` | Eng | Pending counsel | pgTAP 16, 17 |
| 25 | Request contents, including identity documents | S2 | 28 | B | Platform | ARCO form | `identity_verified_at/by` | Eng | Pending counsel | pgTAP 17 |
| 26 | Designate a data-protection person or department | S2 | 29 | B | Platform | Config: data-protection contact | Env config | **Business — unassigned** | **Open question Q1** | `legal-verify` |
| 27 | 20 días hábiles to determine, 15 more to give effect, one extension | S2 | 31 | B | Platform | ARCO queue deadlines | `response_due_at`, `effective_due_at` | Eng | Pending counsel | pgTAP 18 |
| 28 | Denial must name its ground and be communicated | S2 | 33 | B | Platform | `denial_ground` | `privacy_requests` | Eng | Pending counsel | pgTAP 17 |
| 29 | ARCO is free; limited reproduction costs; 3 UMA cap on reiteration under 12 months | S2 | 34 | B | Platform | No charge implemented | n/a | Product | Pending counsel | — |
| 30 | Cancellation is not owed where a contract, a legal duty or fiscal obligations require the data | S2 | 25 fr. I, II, III | B | Platform | `evaluate_cancellation_eligibility` | Blocking-reason list | Eng + counsel | Pending counsel | pgTAP 18 |
| 31 | Transfers: notice clause stating whether the person accepts | S2 | 35, 36 | B | Platform | `/privacidad` transfer section | Published doc version | Counsel | **Open question Q8** | — |
| 32 | Right to oppose automated evaluation with significant effects | S2 | 26 fr. II | B | Platform | ARCO `oposicion` against trust evaluation | `privacy_requests` | Eng + counsel | **Newly identified, §6.4** | pgTAP 16 |
| 33 | PROFECO Monitoreo: contact, total, MXN prices, product characteristics, payment methods, privacy notice, cancellation, shipping | S3 | — (8 criteria) | G | Both | Checkout disclosure + policy routes | Screenshots at verification | Product | Pending counsel | comp. 27 |
| 34 | Código de Ética minimums: commercial name, **domicilio físico, RFC, teléfonos**, complaint mechanisms **with days and hours**, receipt by the same medium | S4 | 6 | **V** | Both, if adhered | Merchant identity, `/quejas-y-aclaraciones`, receipt | Profile + receipt | Business | **Open question Q2** — adherence not applied for | comp. 27 |
| 35 | Adherence to the Código de Ética is voluntary | S4 | 2 | V | — | No adherence claim appears anywhere | — | Product | **Actioned** — no badge, no claim | comp. C1 |
| 36 | Conservation of data messages; certificate of conservation | S6 | NOM-151-SCFI-2016; Cód. Comercio 33, 38, 49 | B | Seller (platform if comerciante) | Receipt immutability, event history | Snapshot + `order_events` | Counsel | **Open question Q9** | pgTAP 24, 26 |
| 37 | CFDI issued by the seller; transferring generation to the client is improper practice | S8 | CFF 29 fr. V; criterio 1/CFF/NV | B | **Seller only** | Seller terms; `invoicing_available` on the profile | Profile field | Counsel | Pending counsel | — |
| 38 | Majority at 18; minors lack contracting capacity | S9 | CCF 646 | B | Both | Age attestation before registration | `age_attestations` | Counsel | **Open question Q6** | comp. 33 |
| 39 | Concilianet only serves proveedores holding a convenio | S7 | — | G | Platform | **Deliberately not mentioned** | This row | Business | **Open question Q10** | comp. C1 |
| 40 | No cookie or analytics notice required | Evidence §1, §7 | LFPDPPP 15 | I | Platform | Privacy notice covers essential cookies and first-party telemetry | Codebase audit, this row | Eng | Confirm at review | comp. C1 |

## 8. Data inventory and retention map

Every location is Supabase Postgres in the project's region unless stated.
Recipients: the platform, the counterparty to a transaction, and Supabase as
`persona encargada` (LFPDPPP art. 2 fr. XII). **No other processor exists** — no
analytics, no email provider yet, no payment processor at all.

| Data | Where | Purpose | Recipients | Retention today | Deletion behaviour |
|---|---|---|---|---|---|
| Email, password hash | `auth.users` | Authentication | Platform | Indefinite | Anonymisation §6.3 |
| Phone `+52…` | `user_contact_details` | Order contact | Platform | Indefinite | Nulled on anonymisation |
| Display name | `user_display_names` | Addressing in conversations | Counterparty | Indefinite | Nulled on anonymisation |
| Delivery address | `order_addresses` | Fulfilment | Seller | **90 days after close**, later while a dispute is open | Cron `plaza-redact-order-addresses` |
| Order, items, totals | `orders`, `order_items` | Contract performance, evidence | Counterparty | Indefinite | Retained — art. 25 fr. I |
| Buyer note, tracking text | `orders` | Fulfilment | Seller | Indefinite | **Open question Q7** |
| Messages | `messages` | Coordination, dispute evidence | Counterparty, admin on audited read | Pre-sale **180 days idle**; order threads indefinite | Cron `messaging-presale-purge`; tombstoned on anonymisation |
| Dispute statements and evidence | `order_disputes` | Dispute handling | Counterparty, admin | Indefinite | **Open question Q7** |
| Reviews | `order_reviews` | Public reputation | Public | Indefinite | Pseudonymised on anonymisation |
| Behavioural events | `buyer_activity_events`, `seller_activity_events`, `*_response_events` | Trust evaluation | Platform | Indefinite | **Open question Q7** |
| Derived trust tiers | `buyer_trust_profiles`, `shop_trust_evaluations` | Listing limits, public standing | Public (shop side) | Indefinite | Subject to art. 26 fr. II opposition, §6.4 |
| Search telemetry | `search_events` | Search quality | Platform | Indefinite | **Not personal data** — no user id, no IP |
| Admin access log | `admin_read_events`, `private.admin_audit_events` | Accountability | Admin | Indefinite | Retained — accountability record |
| Product images | Storage `catalogo` | Catalogue | Public | Indefinite | Deleted with the product |
| Complaint evidence | Storage `reclamaciones` (**new, private**) | Complaint handling | Platform, counterparty where relevant | **Open question Q7** | Deleted with the case after retention |
| Seller RFC, service address | `seller_compliance_profiles` (**new**) | LFPC 76 BIS III identity | Platform; **never public** | **Open question Q7** | Blocked, then suppressed |
| Acceptance evidence | `legal_acceptances` (**new**) | Proof of consent | Platform | Retained under art. 25 fr. I, II | Pseudonymised, never deleted |

Legal holds: `privacy_requests.legal_hold` suspends deletion for a named reason.
Código de Comercio art. 49 imposes a ten-year conservation duty on comerciantes,
which may reach the seller and possibly the platform — Q9.

## 9. Incident response

`docs/legal/incident-response.md`, to be drafted with counsel, covering
detection, severity assessment against LFPDPPP art. 19's "afecten de forma
significativa los derechos patrimoniales o morales", the **immediate**
notification duty to affected persons, the content of that notification, the
internal record, and the decision on notifying the Secretaría. Listed as **not
drafted** in the matrix rather than sketched here.

## 10. Open questions for business and counsel

None of these are guessed anywhere in the implementation. Each blocks a specific
row above.

| Q | Question | Blocks |
|---|---|---|
| Q1 | What is the legal entity? Razón social, RFC, domicilio físico en territorio nacional, teléfonos, correo, horarios de atención, and the designated data-protection person (LFPDPPP art. 29). | Everything. `legal-verify` fails until supplied |
| Q2 | Does the business intend to adhere to the Código de Ética en Comercio Electrónico? Adherence is voluntary, requires filing a project code, and brings quarterly PROFECO monitoring. | Row 34 |
| Q3 | Does LFPC art. 56's five-día-hábil revocation reach these transactions, given it sits in the ventas a domicilio chapter? | Row 14, returns copy |
| Q4 | Should the platform enforce a floor on seller policies (art. 79), or only record both and let the seller's terms stand? | Row 12 |
| Q5 | The full NMX-COE-001-SCFI-2018 text was not obtained — only its declaratoria and scope. Which of its clauses bind through art. 76 BIS 1? | Row 16 |
| Q6 | Is 18+ self-attestation sufficient, and are any listed categories unsuitable for minors such that a warning is required (art. 76 BIS fr. VII)? | Rows 7, 38 |
| Q7 | Retention periods for buyer notes, dispute evidence, behavioural events, complaint evidence and seller RFC. Art. 10 gives 72 months for contractual-breach data; the rest are unset. | Retention map |
| Q8 | Is Supabase a transfer or an encargado under arts. 35–36, and what does the notice's transfer clause say? | Row 31 |
| Q9 | Does Código de Comercio art. 49's ten-year duty reach Plaza Volcanes, and does NOM-151 conservation apply to receipts? | Row 36 |
| Q10 | Should the business pursue a Concilianet convenio? Until then the page cannot offer it. | Row 39 |
| Q11 | May an individual seller's RFC and service address be published, or does a persona física need a protected service-address arrangement? The projection withholds both until answered. | §4.3 |

## 11. Source log

Every source fetched **2026-08-26**. Nothing here is recalled.

| S | Source | URL | Vigencia as fetched |
|---|---|---|---|
| S1 | Ley Federal de Protección al Consumidor | https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf | Nueva Ley DOF 24-12-1992; **última reforma DOF 12-12-2025**; montos DOF 23-12-2025 |
| S2 | Ley Federal de Protección de Datos Personales en Posesión de los Particulares | https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf | **Nueva Ley DOF 20-03-2025**; última reforma DOF 14-11-2025 |
| S3 | PROFECO — Monitoreo de Tiendas Virtuales | https://www.profeco.gob.mx/tiendasvirtuales/ | consultado 2026-08-26 |
| S4 | Acuerdo — Código de Ética en materia de Comercio Electrónico | https://dof.gob.mx/nota_detalle.php?codigo=5612351&fecha=26/02/2021 | DOF 26-02-2021 |
| S5 | NMX-COE-001-SCFI-2018, declaratoria de vigencia | https://www.dof.gob.mx/nota_detalle.php?codigo=5559015&fecha=30/04/2019 | DOF 30-04-2019 |
| S6 | NOM-151-SCFI-2016 | https://dof.gob.mx/nota_detalle.php?codigo=5478024&fecha=30/03/2017 | DOF 30-03-2017 |
| S7 | PROFECO Concilianet | https://concilianet.profeco.gob.mx/Concilianet/comoconciliar.jsp | consultado 2026-08-26 |
| S8 | SAT — criterio no vinculativo 1/CFF/NV, CFF art. 29 | https://sat.gob.mx/articulo/00441/criterio-1/cff/nv | consultado 2026-08-26 |
| S9 | Código Civil Federal | https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf | consultado 2026-08-26 |

**The 2025 LFPDPPP matters more than any other line here.** It replaced the 2010
law, and the regulator is now the **Secretaría Anticorrupción y Buen Gobierno**
(art. 2 fr. XV), not the INAI. Any privacy content drafted from older templates —
including anything a model produced from memory — will name the wrong authority,
the wrong procedure and, in places, the wrong deadlines.

## 12. Migrations

Six additive migrations, filenames from `supabase migration new`, never
hand-invented:

1. `legal_documents`, `legal_document_versions`, immutability trigger,
   `private.publish_legal_version`, `public.current_legal_document`, RLS.
2. `legal_acceptances`, `consent_preferences`, `consent_preference_events`,
   `age_attestations`, `public.record_acceptances`,
   `public.pending_acceptances`, RLS.
3. `seller_compliance_profiles`, `shop_merchant_projection`, reverification
   trigger, access log, RLS.
4. `shop_commerce_policies`, `platform_commerce_policy` (absorbed from the
   landed-cost spec), `orders` snapshot columns, `transaction_reference`
   backfill, `checkout_cart_v3`.
5. `support_cases`, `support_case_evidence`, `reclamaciones` bucket and
   `storage.objects` policies, RLS.
6. `privacy_requests`, `private.evaluate_cancellation_eligibility`,
   `private.anonymize_user`, RLS.

Rollback is dropping the new objects in reverse order. The added `orders`
columns are nullable and may stay behind harmlessly; `checkout_cart_v2` remains
in place through the rollout. Local database only — the linked project is never
reset.

`lib/database.types.ts` is **hand-maintained in this repository**, not generator
output. It carries a bespoke `OrderStatus` union — `orders.status` is a `text`
column with a check constraint, which a generator renders as `string` — and
fifteen exported row aliases that twelve modules import. Running
`supabase gen types` over it deletes all of that and breaks the build. New
tables and functions are added by hand in the file's existing compressed style;
generate into a scratch file when you want to check your entries against the
real schema, and never redirect the generator over the tracked file.

## 13. Tests

**pgTAP** — `supabase/tests/database/`: `legal_documents.test.sql` (1–5),
`consent_evidence.test.sql` (10), `merchant_identity.test.sql` (11–15),
`privacy_arco.test.sql` (16–21), `checkout_receipt.test.sql` (22–26).

**Vitest** — blocking without acceptance (6), unchecked marketing default (7),
marketing refusal does not block purchase (8), withdrawal recorded (9), checkout
disclosure completeness (27), footer links (28), 390 px and desktop layout (29),
keyboard and screen-reader flow (30), required versus optional distinction (31),
announced errors and status (32), no prechecked consent or manipulative design
(33).

**Beyond the 33 requested** — `claims-audit.test.ts` (**C1**): asserts that no
shipped string in `app/`, `components/` or `lib/` contains "compra protegida",
"pago seguro", "garantizado", "vendedor verificado", "sin riesgo", "arbitraje",
"cumplimiento PROFECO", "Concilianet" or any Código de Ética adherence claim,
and that no third-party tracking script is introduced. It fails the suite the
moment an unsupported claim reappears, which is the only durable defence against
row 9 regressing.

**E2E** — `tests/e2e/legal.spec.ts`: buyer reads policies, registers, correct
versions recorded; seller supplies compliance data and reaches an approved
state; buyer sees merchant identity and transaction terms; checkout records
acceptance and creates a receipt; buyer files a complaint; admin handles it with
an audit trail; user submits an ARCO request; unauthorised users reach none of
these records.

## 14. Verification

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npx supabase test db`, Supabase security and performance advisors, the legal
and privacy E2E suite, a browser pass over every public page at desktop and
390 px, sitemap and robots confirmation, and a check that anonymous API
responses expose no private merchant or customer data.

Exact command output is reported, not summarised. A failing gate is reported as
failing.

## 15. Limitations

- **No document is publishable** until counsel approves. That is the design, not
  a gap.
- **Checkout goes dark on landing** and stays dark until the first publish.
- **No PDF generation.** Printable HTML only.
- **No transactional email.** Blocked on SMTP, `docs/domain-follow-ups.md` §3.
- **No seller verification-document handling.** Deferred until counsel decides
  what may be collected and for how long.
- **No identity verification of buyers.** ARCO identity checks are manual and
  admin-reviewed.
- **The platform floor is recorded, not enforced**, against seller policies —
  inherited from the landed-cost spec, and Q4.
- **The buyer-side verification claim is removed from the UI but still emitted
  by the database.** `private.evaluate_buyer_trust` (migration
  `20260820191826`) still builds `'Comprador verificado'` and `'Altamente
  verificado — completó verificación avanzada con documentos oficiales'` into
  the buyer-trust payload, and `lib/buyer-trust.ts` still requires the field in
  a `.strict()` schema, so the strings still reach the client even though
  `BuyerTrustCard` no longer renders them. This is the same unbacked claim as
  the seller-side badges, one layer down.

  It was NOT fixed in this branch, deliberately. The fix means replacing a
  400-line evaluator function whose 36-test pgTAP suite could not be run
  (see the shared-database limitation below), and shipping an unverified change
  to trust scoring is worse than a recorded debt. **Plan 2 must fix this first**,
  and at the same time extend `tests/claims-audit.test.ts` to scan
  `supabase/migrations/*.sql` — that scan would catch this immediately and is the
  natural close of the gap between "no shipped code makes this claim" and "the
  system does not make this claim". The two are coupled: the scan cannot be
  added until the strings are gone.

- **The eight legal routes are in the sitemap and are `noindex` while unpublished.**
  That is deliberate and it will produce "Submitted URL marked noindex" in Search
  Console for all eight until counsel publishes. The URLs are permanent, so
  listing them is correct; suppressing the entries would mean editing the sitemap
  again at launch. The warnings are accepted for the duration of `pre_launch`.

- **The claims-audit guard covers code, not documents.** `tests/claims-audit.test.ts`
  scans `.ts`/`.tsx` under `app`, `components` and `lib`. The eight policy
  documents are database-driven — their text lives in
  `legal_document_versions.body` and is published through the admin workflow, so
  the scanner structurally cannot see it. The most plausible route for a removed
  claim to return is therefore a counsel-drafted document body, and no automated
  check stands in its way.

  This is deliberate, not an oversight. A counsel-approved document may
  legitimately need to name a forbidden phrase in order to disclaim it — "Plaza
  Volcanes no ofrece compra protegida" is correct legal writing that a publish-time
  ban would reject. The division of responsibility is: the test guards code, and
  the human approval recorded in `approved_by` guards document text. Counsel
  reviewing a document body is the control, and it is the only one.

- **Technical implementation does not establish legal compliance.**
