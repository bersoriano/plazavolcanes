# Legal Content System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship eight public policy routes backed by immutable, versioned legal documents that cannot be published without recorded counsel approval, gate the production build on their existence, and remove three claims the site currently makes that nothing backs.

**Architecture:** Two Postgres tables hold a stable document-type registry and its versions. A `before update or delete` trigger makes any published version immutable. One admin-gated `security definer` function is the only writer that can publish, and it snapshots the platform's legal identity into the version so a later config change cannot silently alter a published document. Public routes read only published, effective versions through RLS; when none exists they render an explicit configuration notice instead of placeholder text. A build-time script fails `next build` unless every required type resolves or a checked-in `launch-state.json` acknowledges the gap.

**Tech Stack:** Next.js 16 App Router (React 19 server components), Supabase Postgres with RLS, pgTAP, zod 4, Vitest + Testing Library, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-26-legal-privacy-consent-design.md`

## Global Constraints

- **This is not the Next.js you know.** Read the relevant guide in `node_modules/next/dist/docs/` before writing route or metadata code. `AGENTS.md` is written by `next dev`; commit it with your work rather than reverting it.
- **Migration filenames come from `npx supabase migration new <name>`.** Never hand-invent a timestamp.
- **`lib/database.types.ts` is hand-maintained here — do NOT run `supabase gen types` over it.** It carries a bespoke `OrderStatus` union (`orders.status` is `text` with a check constraint, which the generator renders as `string`) and fifteen exported row aliases that twelve modules import; regenerating deletes all of it and breaks the build. Add new tables and functions by hand in the file's existing compressed style.
- **Local database only.** Never run `db reset` or `db push` against the linked project.
- **RLS on every new table.** Ownership predicates use `(select auth.uid())`. Every `UPDATE` policy carries both `USING` and `WITH CHECK`.
- **Functions are `security invoker`** unless they must not be. Definers live in `private`, carry `set search_path = ''`, are revoked from `public, anon`, and perform an explicit `public.is_current_user_admin()` check. Copy the shape of `private.checkout_cart_internal`.
- **All user-facing copy is Spanish (es-MX).** Code, comments and commit messages are English.
- **No new runtime dependencies.** No Markdown parser, no PDF library.
- **Never write legal text.** Counsel is not engaged. This plan seeds document *types*, never document *content*.
- **No unsupported claims.** These strings must not exist in shipped code: `compra protegida`, `pago seguro`, `garantizado`, `vendedor verificado`, `sin riesgo`, `arbitraje`, `sin riesgos`, `cumplimiento PROFECO`, `Concilianet`.
- **Commit after every task**, using Conventional Commits.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_add_legal_documents.sql` | Registry, versions, immutability trigger, publish RPC, resolver, RLS, type seed |
| `supabase/tests/database/legal_documents.test.sql` | pgTAP: draft invisibility, immutability, publish gate, resolver |
| `lib/legal/document-types.ts` | Shared constants: the ten types, their routes, their Spanish labels |
| `lib/legal/document-types.test.ts` | Guards the registry against the route list drifting |
| `lib/legal/platform-identity.ts` | zod-validated issuer identity read from env; names what is missing |
| `lib/legal/platform-identity.test.ts` | Missing-variable reporting |
| `lib/queries/legal.server.ts` | `getPublishedLegalDocument`, `getRequiredDocumentStatus` |
| `lib/queries/legal.server.test.ts` | Null on unpublished, shape on published |
| `components/legal/legal-document.tsx` | Renders a version's sections with anchored headings |
| `components/legal/legal-document.test.tsx` | Heading anchors, issuer block, version footer |
| `components/legal/legal-unavailable.tsx` | Explicit configuration notice |
| `components/legal/legal-unavailable.test.tsx` | States the reason, offers no acceptance control |
| `app/(legal)/layout.tsx` | Shared legal shell: measure, print styles, skip target |
| `app/(legal)/legal-route.tsx` | Server component resolving one type to document or notice |
| `app/(legal)/terminos/page.tsx` … 8 routes | One thin page per public path |
| `scripts/legal-verify.mjs` | Build gate |
| `docs/legal/launch-state.json` | Reviewable pre-launch declaration |
| `tests/claims-audit.test.ts` | Fails if a removed claim reappears |

**Modified**

| File | Change |
|---|---|
| `lib/trust-markers.ts` | Delete `generateVerificationMarker` and its four markers |
| `components/shops/trust-badges.tsx` | Drop the verification badge |
| `components/orders/buyer-trust-card.tsx:107` | Drop the verification `IdentityMarker` |
| `components/home/trust-strip.tsx` | Replace the arbitration promise |
| `components/layout/site-footer.tsx` | Persistent legal column |
| `app/sitemap.ts`, `app/robots.ts` | Publish the eight routes |
| `package.json` | `build` runs the gate first |

---

### Task 1: Legal document schema

**Files:**
- Create: `supabase/migrations/<generated>_add_legal_documents.sql`
- Test: `supabase/tests/database/legal_documents.test.sql`

**Interfaces:**
- Consumes: `public.is_current_user_admin()`, `private.admin_audit_events` (both exist)
- Produces: tables `public.legal_documents`, `public.legal_document_versions`; functions `public.current_legal_document(text) returns public.legal_document_versions` and `public.publish_legal_version(uuid, jsonb) returns public.legal_document_versions`

- [ ] **Step 1: Create the migration file**

```bash
npx supabase migration new add_legal_documents
```

Note the generated path. Every reference below to `<generated>` means that file.

- [ ] **Step 2: Write the failing pgTAP test**

Create `supabase/tests/database/legal_documents.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'legal_documents', 'the document type registry exists');
select has_table('public', 'legal_document_versions', 'document versions exist');

select results_eq(
  $$select count(*) from public.legal_documents where is_required$$,
  array[10::bigint],
  'ten required document types are seeded'
);

insert into auth.users (id, email, created_at) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@test.local', now()),
  ('a0000000-0000-4000-8000-000000000002', 'buyer@test.local', now());

insert into private.admin_users (user_id, granted_by)
values ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001');

insert into public.legal_document_versions
  (id, document_type, version, status, title, body, change_summary, effective_at, approved_by, approved_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'platform_terms', 1, 'draft',
   'Terminos borrador', '{"sections": []}'::jsonb, 'primera version', now(), null, null),
  ('b0000000-0000-4000-8000-000000000002', 'privacy_notice', 1, 'approved',
   'Aviso aprobado', '{"sections": []}'::jsonb, 'primera version', now(), 'Lic. Prueba', now());

-- anonymous visitors see nothing that is not published
set local role anon;
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[0::bigint],
  'anonymous visitors cannot read drafts or approved versions'
);
reset role;

-- only an admin may publish
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000002', '{"rfc":"X"}'::jsonb)$$,
  '42501', null, 'a non-admin cannot publish a legal version'
);
reset role;

-- a draft cannot be published
set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000001', '{"rfc":"X"}'::jsonb)$$,
  '22023', null, 'a draft cannot be published'
);

select lives_ok(
  $$select public.publish_legal_version('b0000000-0000-4000-8000-000000000002', '{"rfc":"XAXX010101000"}'::jsonb)$$,
  'an approved version publishes'
);
reset role;

select isnt(
  (select content_hash from public.legal_document_versions where id = 'b0000000-0000-4000-8000-000000000002'),
  null,
  'publishing computes a content hash'
);

-- published versions are immutable
select throws_ok(
  $$update public.legal_document_versions set title = 'otro' where id = 'b0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'a published version cannot be edited'
);

select throws_ok(
  $$delete from public.legal_document_versions where id = 'b0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'a legal version cannot be deleted'
);

-- published versions are public, and resolve
set local role anon;
select results_eq(
  $$select count(*) from public.legal_document_versions$$,
  array[1::bigint],
  'anonymous visitors read exactly the published version'
);

select results_eq(
  $$select (public.current_legal_document('privacy_notice')).version$$,
  array[1::integer],
  'the resolver returns the published version'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx supabase start
npx supabase test db
```

Expected: FAIL — `relation "public.legal_documents" does not exist`.

- [ ] **Step 4: Write the migration**

Write into `<generated>`:

```sql
-- Legal documents are contracts and statutory notices. A published version is
-- evidence of what a person agreed to, so it is immutable at the table, and the
-- only path to publishing runs through an admin-gated function that records who
-- approved it. Drafts are invisible to every non-admin reader, which is what
-- keeps unreviewed text from ever reaching a buyer.

create extension if not exists pgcrypto with schema extensions;

create table public.legal_documents (
  type text primary key,
  is_required boolean not null default true,
  public_path text unique check (public_path is null or public_path ~ '^/[a-z0-9-]+$'),
  sort_order smallint not null default 0
);

create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_type text not null references public.legal_documents (type) on delete restrict,
  version integer not null check (version >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'published', 'retired')),
  locale text not null default 'es-MX',
  title text not null check (char_length(btrim(title)) between 3 and 200),
  -- {"sections": [{"id": "...", "heading": "...", "paragraphs": ["..."]}]}
  body jsonb not null default '{"sections": []}'::jsonb,
  issuer_identity jsonb,
  content_hash text,
  change_summary text not null check (char_length(btrim(change_summary)) between 3 and 1000),
  is_material boolean not null default true,
  effective_at timestamptz,
  published_at timestamptz,
  retired_at timestamptz,
  approved_by text check (approved_by is null or char_length(btrim(approved_by)) between 3 and 200),
  approved_at timestamptz,
  supersedes_version_id uuid references public.legal_document_versions (id),
  created_at timestamptz not null default now(),
  unique (document_type, version),
  constraint published_versions_are_complete check (
    status <> 'published' or (
      issuer_identity is not null and content_hash is not null
      and effective_at is not null and published_at is not null
      and approved_by is not null and approved_at is not null
    )
  )
);

create index legal_document_versions_current_idx
  on public.legal_document_versions (document_type, effective_at desc)
  where status = 'published';

revoke all on table public.legal_documents, public.legal_document_versions
  from public, anon, authenticated;
grant select on table public.legal_documents, public.legal_document_versions
  to anon, authenticated;
grant select, insert, update, delete
  on table public.legal_documents, public.legal_document_versions to service_role;

alter table public.legal_documents enable row level security;
alter table public.legal_document_versions enable row level security;

create policy legal_documents_are_public on public.legal_documents
  for select to anon, authenticated using (true);

-- The whole guarantee that a draft never reaches a buyer lives in this one
-- predicate. There is deliberately no insert, update or delete policy for any
-- client role: the publish function is the only writer.
create policy published_versions_are_public on public.legal_document_versions
  for select to anon, authenticated
  using (status = 'published' and effective_at <= now());

create policy admins_read_every_version on public.legal_document_versions
  for select to authenticated
  using ((select public.is_current_user_admin()));

create function private.guard_published_legal_versions()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501',
      message = 'Una versión legal no se elimina.';
  end if;

  if old.status = 'retired' then
    raise exception using errcode = '42501',
      message = 'Una versión retirada es inmutable.';
  end if;

  if old.status = 'published' then
    -- The single permitted transition: retiring a version when its successor
    -- publishes. Everything that carries meaning must be untouched.
    if new.status = 'retired'
      and new.document_type = old.document_type
      and new.version = old.version
      and new.title = old.title
      and new.body = old.body
      and new.content_hash is not distinct from old.content_hash
      and new.issuer_identity is not distinct from old.issuer_identity
      and new.effective_at is not distinct from old.effective_at
      and new.published_at is not distinct from old.published_at
      and new.approved_by is not distinct from old.approved_by
      and new.approved_at is not distinct from old.approved_at
    then
      return new;
    end if;

    raise exception using errcode = '42501',
      message = 'Una versión publicada es inmutable.';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_published_legal_versions()
  from public, anon, authenticated;

create trigger guard_published_legal_versions
  before update or delete on public.legal_document_versions
  for each row execute function private.guard_published_legal_versions();

-- Publishing records an existing audit action vocabulary, so widen it.
alter table private.admin_audit_events
  drop constraint if exists admin_audit_events_action_check;
alter table private.admin_audit_events
  add constraint admin_audit_events_action_check
  check (action in ('admin_granted', 'admin_revoked', 'dispute_resolved',
                    'legal_version_published'));

-- The issuer identity is snapshotted rather than rendered live: if the page
-- read it from configuration, changing an environment variable would silently
-- alter a document whose hash claims immutability.
create function public.publish_legal_version(p_version_id uuid, p_issuer_identity jsonb)
returns public.legal_document_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.legal_document_versions;
  v_current uuid;
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501',
      message = 'Solo administración publica documentos legales.';
  end if;

  select * into v_row from public.legal_document_versions
  where id = p_version_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La versión no existe.';
  end if;

  if v_row.status <> 'approved' then
    raise exception using errcode = '22023',
      message = 'Solo una versión aprobada puede publicarse.';
  end if;

  if v_row.approved_by is null or v_row.approved_at is null or v_row.effective_at is null then
    raise exception using errcode = '22023',
      message = 'Falta la aprobación legal o la fecha de entrada en vigor.';
  end if;

  if p_issuer_identity is null or p_issuer_identity = '{}'::jsonb then
    raise exception using errcode = '22023',
      message = 'Falta la identidad del responsable.';
  end if;

  select id into v_current
  from public.legal_document_versions
  where document_type = v_row.document_type and status = 'published'
  order by effective_at desc limit 1;

  update public.legal_document_versions
  set status = 'published',
      issuer_identity = p_issuer_identity,
      content_hash = encode(
        extensions.digest(v_row.body::text || p_issuer_identity::text, 'sha256'), 'hex'),
      published_at = now(),
      supersedes_version_id = v_current
  where id = p_version_id
  returning * into v_row;

  if v_current is not null then
    update public.legal_document_versions
    set status = 'retired', retired_at = now()
    where id = v_current;
  end if;

  insert into private.admin_audit_events (actor_id, action, metadata)
  values (
    auth.uid(), 'legal_version_published',
    jsonb_build_object('version_id', p_version_id,
                       'document_type', v_row.document_type,
                       'version', v_row.version)
  );

  return v_row;
end;
$$;

revoke all on function public.publish_legal_version(uuid, jsonb) from public, anon;
grant execute on function public.publish_legal_version(uuid, jsonb) to authenticated;

create function public.current_legal_document(p_type text)
returns public.legal_document_versions
language sql
stable
security invoker
set search_path = ''
as $$
  select v.*
  from public.legal_document_versions v
  where v.document_type = p_type
    and v.status = 'published'
    and v.effective_at <= now()
  order by v.effective_at desc, v.version desc
  limit 1
$$;

revoke all on function public.current_legal_document(text) from public;
grant execute on function public.current_legal_document(text) to anon, authenticated;

-- Types only. No content: counsel is not engaged, and this migration does not
-- invent legal text.
insert into public.legal_documents (type, is_required, public_path, sort_order) values
  ('platform_terms',    true, '/terminos',                10),
  ('privacy_notice',    true, '/privacidad',              20),
  ('returns_policy',    true, '/compras-y-devoluciones',  30),
  ('warranty_policy',   true, '/garantias',               40),
  ('shipping_policy',   true, '/envios',                  50),
  ('security_guidance', true, '/seguridad',               60),
  ('complaints_policy', true, '/quejas-y-aclaraciones',   70),
  ('seller_terms',      true, '/terminos-vendedores',     80),
  ('buyer_terms',       true, null,                       90),
  ('marketplace_role',  true, null,                      100);

-- Rollback:
-- drop function public.current_legal_document(text);
-- drop function public.publish_legal_version(uuid, jsonb);
-- drop trigger guard_published_legal_versions on public.legal_document_versions;
-- drop function private.guard_published_legal_versions();
-- drop table public.legal_document_versions;
-- drop table public.legal_documents;
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx supabase test db
```

Expected: PASS, 12 of 12.

- [ ] **Step 6: Verify the security posture locally**

`npx supabase inspect db table-stats` connects to the **linked remote project**
unless you pass `--local`, which the Global Constraints forbid. Verify against
the local database instead:

```bash
npx supabase inspect db table-stats --local
```

Then confirm the posture directly, which is what the advisors would report:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select relname, relrowsecurity
from pg_class
where relname in ('legal_documents', 'legal_document_versions');
select proname, prosecdef, proconfig
from pg_proc
where proname in ('publish_legal_version', 'current_legal_document',
                  'guard_published_legal_versions');
"
```

Expected: `relrowsecurity` true for both tables; `publish_legal_version`
`prosecdef` true with `search_path=` in `proconfig`; `current_legal_document`
`prosecdef` false.

Run the hosted advisors separately, against the linked project, only once this
branch is actually deployed — not from this task.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations supabase/tests/database/legal_documents.test.sql
git commit -m "feat(legal): add immutable versioned legal document registry"
```

---

### Task 2: Regenerate types and publish the shared registry

**Files:**
- Modify: `lib/database.types.ts` (regenerated — never hand-edited)
- Create: `lib/legal/document-types.ts`
- Test: `lib/legal/document-types.test.ts`

**Interfaces:**
- Consumes: the tables from Task 1
- Produces: `LEGAL_DOCUMENT_TYPES` (readonly array), `type LegalDocumentType`, `LEGAL_ROUTES` (array of `{ type, path, navLabel, title }`), `REQUIRED_LEGAL_TYPES`

- [ ] **Step 1: Add the new tables to the database types by hand**

Do **not** redirect `supabase gen types` over `lib/database.types.ts`. That file
is hand-maintained: `orders.status` is a `text` column, so the generator emits
`status: string` and destroys the `OrderStatus` union, and the fifteen aliases
at the tail vanish. Twelve modules import those.

To check your entries against the real schema, generate into a scratch file and
read it — never over the tracked one:

```bash
npx supabase gen types typescript --local > /tmp/generated-types.ts
```

Then edit `lib/database.types.ts` by hand, matching its existing compressed
style. Add beside `OrderStatus` near the top:

```ts
export type LegalDocumentStatus = "draft" | "approved" | "published" | "retired";
```

Add to `Tables`, in alphabetical position:

```ts
      legal_documents: {
        Row: { type: string; is_required: boolean; public_path: string | null; sort_order: number };
        Insert: { type: string; is_required?: boolean; public_path?: string | null; sort_order?: number };
        Update: { type?: string; is_required?: boolean; public_path?: string | null; sort_order?: number };
        Relationships: [];
      };
      legal_document_versions: {
        Row: { id: string; document_type: string; version: number; status: LegalDocumentStatus; locale: string; title: string; body: Json; issuer_identity: Json | null; content_hash: string | null; change_summary: string; is_material: boolean; effective_at: string | null; published_at: string | null; retired_at: string | null; approved_by: string | null; approved_at: string | null; supersedes_version_id: string | null; created_at: string };
        Insert: { id?: string; document_type: string; version: number; status?: LegalDocumentStatus; locale?: string; title: string; body?: Json; issuer_identity?: Json | null; content_hash?: string | null; change_summary: string; is_material?: boolean; effective_at?: string | null; published_at?: string | null; retired_at?: string | null; approved_by?: string | null; approved_at?: string | null; supersedes_version_id?: string | null; created_at?: string };
        Update: { id?: string; document_type?: string; version?: number; status?: LegalDocumentStatus; locale?: string; title?: string; body?: Json; issuer_identity?: Json | null; content_hash?: string | null; change_summary?: string; is_material?: boolean; effective_at?: string | null; published_at?: string | null; retired_at?: string | null; approved_by?: string | null; approved_at?: string | null; supersedes_version_id?: string | null; created_at?: string };
        Relationships: [];
      };
```

Add to `Functions`, in alphabetical position:

```ts
      current_legal_document: { Args: { p_type: string }; Returns: Database["public"]["Tables"]["legal_document_versions"]["Row"] };
      publish_legal_version: { Args: { p_version_id: string; p_issuer_identity: Json }; Returns: Database["public"]["Tables"]["legal_document_versions"]["Row"] };
```

Add to the alias block at the end of the file:

```ts
export type LegalDocument = Database["public"]["Tables"]["legal_documents"]["Row"];
export type LegalDocumentVersion = Database["public"]["Tables"]["legal_document_versions"]["Row"];
```

Confirm your `Row` fields match the migration column-for-column against
`/tmp/generated-types.ts`, then:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 2: Write the failing test**

Create `lib/legal/document-types.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_ROUTES,
  REQUIRED_LEGAL_TYPES,
} from "@/lib/legal/document-types";

describe("legal document registry", () => {
  it("lists every type the migration seeds", () => {
    expect(LEGAL_DOCUMENT_TYPES).toHaveLength(10);
    expect(LEGAL_DOCUMENT_TYPES).toContain("platform_terms");
    expect(LEGAL_DOCUMENT_TYPES).toContain("marketplace_role");
  });

  it("exposes eight public routes", () => {
    expect(LEGAL_ROUTES).toHaveLength(8);
    expect(LEGAL_ROUTES.map((route) => route.path)).toEqual([
      "/terminos",
      "/privacidad",
      "/compras-y-devoluciones",
      "/garantias",
      "/envios",
      "/seguridad",
      "/quejas-y-aclaraciones",
      "/terminos-vendedores",
    ]);
  });

  it("routes only to types the registry knows", () => {
    for (const route of LEGAL_ROUTES) {
      expect(LEGAL_DOCUMENT_TYPES).toContain(route.type);
    }
  });

  it("requires every seeded type", () => {
    expect(REQUIRED_LEGAL_TYPES).toEqual(LEGAL_DOCUMENT_TYPES);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run lib/legal/document-types.test.ts
```

Expected: FAIL — cannot resolve `@/lib/legal/document-types`.

- [ ] **Step 4: Write the registry**

Create `lib/legal/document-types.ts`:

```ts
// The database is the source of truth for which documents exist; this mirrors
// the seed so routes, the footer and the build gate all read one list. The
// test above fails if the two drift.

export const LEGAL_DOCUMENT_TYPES = [
  "platform_terms",
  "privacy_notice",
  "returns_policy",
  "warranty_policy",
  "shipping_policy",
  "security_guidance",
  "complaints_policy",
  "seller_terms",
  "buyer_terms",
  "marketplace_role",
] as const;

export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const REQUIRED_LEGAL_TYPES: readonly LegalDocumentType[] =
  LEGAL_DOCUMENT_TYPES;

export type LegalRoute = {
  type: LegalDocumentType;
  path: string;
  /** Short label for the footer. */
  navLabel: string;
  /** Fallback page title while no version is published. */
  title: string;
};

export const LEGAL_ROUTES: readonly LegalRoute[] = [
  { type: "platform_terms", path: "/terminos", navLabel: "Términos", title: "Términos y condiciones" },
  { type: "privacy_notice", path: "/privacidad", navLabel: "Privacidad", title: "Aviso de privacidad" },
  { type: "returns_policy", path: "/compras-y-devoluciones", navLabel: "Compras y devoluciones", title: "Compras, cancelaciones y devoluciones" },
  { type: "warranty_policy", path: "/garantias", navLabel: "Garantías", title: "Garantías" },
  { type: "shipping_policy", path: "/envios", navLabel: "Envíos", title: "Envíos y entregas" },
  { type: "security_guidance", path: "/seguridad", navLabel: "Seguridad", title: "Seguridad y prevención de fraude" },
  { type: "complaints_policy", path: "/quejas-y-aclaraciones", navLabel: "Quejas y aclaraciones", title: "Quejas y aclaraciones" },
  { type: "seller_terms", path: "/terminos-vendedores", navLabel: "Términos para vendedores", title: "Términos para vendedores" },
] as const;
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run lib/legal/document-types.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/database.types.ts lib/legal/document-types.ts lib/legal/document-types.test.ts
git commit -m "feat(legal): add shared legal document registry"
```

---

### Task 3: Platform identity configuration

**Files:**
- Create: `lib/legal/platform-identity.ts`
- Test: `lib/legal/platform-identity.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `readPlatformIdentity(env?: NodeJS.ProcessEnv): PlatformIdentityResult` where the result is `{ ok: true; identity: PlatformIdentity } | { ok: false; missing: string[] }`, and `PLATFORM_IDENTITY_VARS: readonly string[]`

- [ ] **Step 1: Write the failing test**

Create `lib/legal/platform-identity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  PLATFORM_IDENTITY_VARS,
  readPlatformIdentity,
} from "@/lib/legal/platform-identity";

const complete = {
  PLAZA_LEGAL_ENTITY_NAME: "Ejemplo S.A. de C.V.",
  PLAZA_LEGAL_RFC: "EJE010101AB1",
  PLAZA_LEGAL_ADDRESS: "Calle Falsa 123, Guadalajara, Jalisco, 44100",
  PLAZA_LEGAL_EMAIL: "contacto@ejemplo.mx",
  PLAZA_LEGAL_PHONE: "+523312345678",
  PLAZA_LEGAL_ATTENTION_HOURS: "Lunes a viernes de 9:00 a 18:00",
  PLAZA_PRIVACY_CONTACT: "datos@ejemplo.mx",
};

describe("readPlatformIdentity", () => {
  it("names every variable it needs", () => {
    expect(PLATFORM_IDENTITY_VARS).toHaveLength(7);
  });

  it("returns the identity when every variable is present", () => {
    const result = readPlatformIdentity(complete);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity.entityName).toBe("Ejemplo S.A. de C.V.");
    expect(result.identity.rfc).toBe("EJE010101AB1");
  });

  it("lists what is missing instead of throwing", () => {
    const result = readPlatformIdentity({
      ...complete,
      PLAZA_LEGAL_RFC: "",
      PLAZA_PRIVACY_CONTACT: undefined,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["PLAZA_LEGAL_RFC", "PLAZA_PRIVACY_CONTACT"]);
  });

  it("treats an invalid RFC as missing rather than accepting it", () => {
    const result = readPlatformIdentity({ ...complete, PLAZA_LEGAL_RFC: "nope" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain("PLAZA_LEGAL_RFC");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/legal/platform-identity.test.ts
```

Expected: FAIL — cannot resolve `@/lib/legal/platform-identity`.

- [ ] **Step 3: Write the configuration reader**

Create `lib/legal/platform-identity.ts`:

```ts
import { z } from "zod";

// None of these facts exist yet. Nothing in this codebase invents them: the
// build gate names each missing variable and refuses, and the publish function
// refuses an empty identity. See spec §2.

export const PLATFORM_IDENTITY_VARS = [
  "PLAZA_LEGAL_ENTITY_NAME",
  "PLAZA_LEGAL_RFC",
  "PLAZA_LEGAL_ADDRESS",
  "PLAZA_LEGAL_EMAIL",
  "PLAZA_LEGAL_PHONE",
  "PLAZA_LEGAL_ATTENTION_HOURS",
  "PLAZA_PRIVACY_CONTACT",
] as const;

// Personas morales carry 12 characters, personas físicas 13.
const RFC = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

const schema = z.object({
  PLAZA_LEGAL_ENTITY_NAME: z.string().trim().min(3),
  PLAZA_LEGAL_RFC: z.string().trim().toUpperCase().regex(RFC),
  PLAZA_LEGAL_ADDRESS: z.string().trim().min(10),
  PLAZA_LEGAL_EMAIL: z.email(),
  PLAZA_LEGAL_PHONE: z.string().trim().regex(/^\+52[0-9]{10}$/),
  PLAZA_LEGAL_ATTENTION_HOURS: z.string().trim().min(5),
  PLAZA_PRIVACY_CONTACT: z.email(),
});

export type PlatformIdentity = {
  entityName: string;
  rfc: string;
  address: string;
  email: string;
  phone: string;
  attentionHours: string;
  privacyContact: string;
};

export type PlatformIdentityResult =
  | { ok: true; identity: PlatformIdentity }
  | { ok: false; missing: string[] };

export function readPlatformIdentity(
  env: Record<string, string | undefined> = process.env,
): PlatformIdentityResult {
  const parsed = schema.safeParse(
    Object.fromEntries(
      PLATFORM_IDENTITY_VARS.map((name) => [name, env[name]?.trim() || undefined]),
    ),
  );

  if (!parsed.success) {
    // A malformed value is reported the same way a missing one is: it cannot be
    // used, and the person fixing it needs the variable name either way.
    const missing = new Set(
      parsed.error.issues.map((issue) => String(issue.path[0])),
    );

    return {
      ok: false,
      missing: PLATFORM_IDENTITY_VARS.filter((name) => missing.has(name)),
    };
  }

  return {
    ok: true,
    identity: {
      entityName: parsed.data.PLAZA_LEGAL_ENTITY_NAME,
      rfc: parsed.data.PLAZA_LEGAL_RFC,
      address: parsed.data.PLAZA_LEGAL_ADDRESS,
      email: parsed.data.PLAZA_LEGAL_EMAIL,
      phone: parsed.data.PLAZA_LEGAL_PHONE,
      attentionHours: parsed.data.PLAZA_LEGAL_ATTENTION_HOURS,
      privacyContact: parsed.data.PLAZA_PRIVACY_CONTACT,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/legal/platform-identity.test.ts
```

Expected: PASS, 4 tests. If `z.email()` is unavailable, this repository is not on zod 4 — check `package.json` before changing the schema.

- [ ] **Step 5: Commit**

```bash
git add lib/legal/platform-identity.ts lib/legal/platform-identity.test.ts
git commit -m "feat(legal): validate platform legal identity configuration"
```

---

### Task 4: Server query layer

**Files:**
- Create: `lib/queries/legal.server.ts`
- Test: `lib/queries/legal.server.test.ts`

**Interfaces:**
- Consumes: `createServerSupabaseClient`, `isSupabaseConfigured`, `LegalDocumentType`
- Produces: `getPublishedLegalDocument(type: LegalDocumentType): Promise<PublishedLegalDocument | null>` and `type PublishedLegalDocument = { id: string; type: LegalDocumentType; version: number; title: string; sections: LegalSection[]; issuerIdentity: Record<string, string> | null; contentHash: string; effectiveAt: string; publishedAt: string }`, plus `type LegalSection = { id: string; heading: string; paragraphs: string[] }`

- [ ] **Step 1: Write the failing test**

Create `lib/queries/legal.server.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc }),
}));

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: () => true,
}));

afterEach(() => {
  rpc.mockReset();
});

describe("getPublishedLegalDocument", () => {
  it("returns null when nothing is published", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    await expect(getPublishedLegalDocument("platform_terms")).resolves.toBeNull();
  });

  it("returns null when the query errors rather than throwing into a page", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    await expect(getPublishedLegalDocument("platform_terms")).resolves.toBeNull();
  });

  it("maps a published row onto the document shape", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "b0000000-0000-4000-8000-000000000002",
        document_type: "privacy_notice",
        version: 3,
        title: "Aviso de privacidad",
        body: { sections: [{ id: "responsable", heading: "Responsable", paragraphs: ["Uno."] }] },
        issuer_identity: { rfc: "EJE010101AB1" },
        content_hash: "abc123",
        effective_at: "2026-09-01T00:00:00.000Z",
        published_at: "2026-08-30T00:00:00.000Z",
      },
      error: null,
    });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    const doc = await getPublishedLegalDocument("privacy_notice");

    expect(doc?.version).toBe(3);
    expect(doc?.sections).toHaveLength(1);
    expect(doc?.sections[0].heading).toBe("Responsable");
    expect(doc?.contentHash).toBe("abc123");
  });

  it("tolerates a body with no sections array", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "b1", document_type: "platform_terms", version: 1, title: "Términos",
        body: {}, issuer_identity: null, content_hash: "h",
        effective_at: "2026-09-01T00:00:00.000Z", published_at: "2026-08-30T00:00:00.000Z",
      },
      error: null,
    });
    const { getPublishedLegalDocument } = await import("@/lib/queries/legal.server");

    await expect(getPublishedLegalDocument("platform_terms")).resolves.toMatchObject({
      sections: [],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/queries/legal.server.test.ts
```

Expected: FAIL — cannot resolve `@/lib/queries/legal.server`.

- [ ] **Step 3: Write the query layer**

Create `lib/queries/legal.server.ts`:

```ts
import "server-only";

import type { LegalDocumentType } from "@/lib/legal/document-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
};

export type PublishedLegalDocument = {
  id: string;
  type: LegalDocumentType;
  version: number;
  title: string;
  sections: LegalSection[];
  issuerIdentity: Record<string, string> | null;
  contentHash: string;
  effectiveAt: string;
  publishedAt: string;
};

function readSections(body: unknown): LegalSection[] {
  if (!body || typeof body !== "object") return [];
  const sections = (body as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];

  return sections.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { id, heading, paragraphs } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof heading !== "string") return [];

    return [{
      id,
      heading,
      paragraphs: Array.isArray(paragraphs)
        ? paragraphs.filter((p): p is string => typeof p === "string")
        : [],
    }];
  });
}

/**
 * Resolves the published, effective version of one document type, or null.
 *
 * Null is the honest answer for every failure here — unpublished, misconfigured
 * or unreachable. The route renders an explicit configuration notice for all
 * three rather than throwing a 500 or, worse, showing placeholder legal text.
 */
export async function getPublishedLegalDocument(
  type: LegalDocumentType,
): Promise<PublishedLegalDocument | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_legal_document", { p_type: type });

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  if (typeof row.id !== "string") return null;

  return {
    id: row.id,
    type,
    version: Number(row.version),
    title: String(row.title ?? ""),
    sections: readSections(row.body),
    issuerIdentity:
      row.issuer_identity && typeof row.issuer_identity === "object"
        ? (row.issuer_identity as Record<string, string>)
        : null,
    contentHash: String(row.content_hash ?? ""),
    effectiveAt: String(row.effective_at ?? ""),
    publishedAt: String(row.published_at ?? ""),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run lib/queries/legal.server.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/legal.server.ts lib/queries/legal.server.test.ts
git commit -m "feat(legal): read published legal documents"
```

---

### Task 5: Document and unavailable-notice components

**Files:**
- Create: `components/legal/legal-document.tsx`, `components/legal/legal-unavailable.tsx`
- Test: `components/legal/legal-document.test.tsx`, `components/legal/legal-unavailable.test.tsx`

**Interfaces:**
- Consumes: `PublishedLegalDocument`, `LegalRoute`
- Produces: `<LegalDocument document={PublishedLegalDocument} />`, `<LegalUnavailable route={LegalRoute} />`

- [ ] **Step 1: Write the failing tests**

Create `components/legal/legal-document.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalDocument } from "@/components/legal/legal-document";

afterEach(cleanup);

const document = {
  id: "b1",
  type: "privacy_notice" as const,
  version: 2,
  title: "Aviso de privacidad",
  sections: [
    { id: "responsable", heading: "Responsable", paragraphs: ["Primer párrafo.", "Segundo."] },
    { id: "arco", heading: "Derechos ARCO", paragraphs: ["Cómo ejercerlos."] },
  ],
  issuerIdentity: {
    entityName: "Ejemplo S.A. de C.V.",
    rfc: "EJE010101AB1",
    address: "Calle Falsa 123",
  },
  contentHash: "abc123def456",
  effectiveAt: "2026-09-01T00:00:00.000Z",
  publishedAt: "2026-08-30T00:00:00.000Z",
};

describe("LegalDocument", () => {
  it("renders the title as the page heading", () => {
    render(<LegalDocument document={document} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Aviso de privacidad" }),
    ).toBeInTheDocument();
  });

  it("gives every section a linkable heading", () => {
    render(<LegalDocument document={document} />);

    const heading = screen.getByRole("heading", { level: 2, name: "Derechos ARCO" });
    expect(heading).toHaveAttribute("id", "arco");
  });

  it("renders every paragraph", () => {
    render(<LegalDocument document={document} />);

    expect(screen.getByText("Primer párrafo.")).toBeInTheDocument();
    expect(screen.getByText("Segundo.")).toBeInTheDocument();
  });

  it("shows the issuer identity the version was published with", () => {
    render(<LegalDocument document={document} />);

    expect(screen.getByText(/Ejemplo S\.A\. de C\.V\./)).toBeInTheDocument();
    expect(screen.getByText(/EJE010101AB1/)).toBeInTheDocument();
  });

  it("states the version and its content hash so a person can cite it", () => {
    render(<LegalDocument document={document} />);

    expect(screen.getByText(/Versión 2/)).toBeInTheDocument();
    expect(screen.getByText(/abc123def456/)).toBeInTheDocument();
  });
});
```

Create `components/legal/legal-unavailable.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalUnavailable } from "@/components/legal/legal-unavailable";

afterEach(cleanup);

const route = {
  type: "platform_terms" as const,
  path: "/terminos",
  navLabel: "Términos",
  title: "Términos y condiciones",
};

describe("LegalUnavailable", () => {
  it("names the document that is missing", () => {
    render(<LegalUnavailable route={route} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Términos y condiciones" }),
    ).toBeInTheDocument();
  });

  it("says plainly that no approved version is published", () => {
    render(<LegalUnavailable route={route} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /no hay una versión aprobada y publicada/i,
    );
  });

  it("offers no control that could be read as acceptance", () => {
    render(<LegalUnavailable route={route} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows no placeholder legal text", () => {
    const { container } = render(<LegalUnavailable route={route} />);

    expect(container.textContent).not.toMatch(/lorem|próximamente|pendiente de redacción/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run components/legal
```

Expected: FAIL — cannot resolve either component.

- [ ] **Step 3: Write the components**

Create `components/legal/legal-document.tsx`:

```tsx
import type { PublishedLegalDocument } from "@/lib/queries/legal.server";

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Mexico_City",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function LegalDocument({ document }: { document: PublishedLegalDocument }) {
  const identity = document.issuerIdentity;

  return (
    <article className="mx-auto max-w-[68ch]">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">
        {document.title}
      </h1>
      <p className="mt-3 text-sm text-muted">
        Vigente desde el {formatDate(document.effectiveAt)}.
      </p>

      {document.sections.map((section) => (
        <section className="mt-10" key={section.id}>
          <h2
            className="scroll-mt-24 font-display text-2xl font-semibold text-ink"
            id={section.id}
          >
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph, index) => (
            <p className="mt-4 leading-7 text-ink" key={`${section.id}-${index}`}>
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      {identity ? (
        <section className="mt-12 rounded-[1.5rem] border border-line bg-surface p-6">
          <h2 className="font-display text-xl font-semibold" id="responsable-identidad">
            Responsable de este documento
          </h2>
          <dl className="mt-4 grid gap-2 text-sm leading-6 text-muted">
            {Object.entries(identity).map(([key, value]) => (
              <div className="flex flex-wrap gap-x-2" key={key}>
                <dt className="font-semibold text-ink">{key}:</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* The hash lets a person prove which text they read. */}
      <p className="mt-10 border-t border-line pt-5 text-xs leading-5 text-muted">
        Versión {document.version} · publicada el {formatDate(document.publishedAt)} ·
        huella de contenido {document.contentHash}
      </p>
    </article>
  );
}
```

Create `components/legal/legal-unavailable.tsx`:

```tsx
import type { LegalRoute } from "@/lib/legal/document-types";

/**
 * Shown when no approved version is published. It is deliberately not a 404 and
 * deliberately not placeholder text: a person arriving here must be able to
 * tell that the document does not exist yet, rather than read something that
 * looks binding and is not.
 */
export function LegalUnavailable({ route }: { route: LegalRoute }) {
  return (
    <article className="mx-auto max-w-[68ch]">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">
        {route.title}
      </h1>
      <p
        className="mt-6 rounded-[1.5rem] border border-sale/30 bg-sale/5 p-6 leading-7 text-ink"
        role="status"
      >
        Este documento aún no está disponible: no hay una versión aprobada y
        publicada. Plaza Volcanes no puede aceptar solicitudes de compra hasta
        que exista.
      </p>
      <p className="mt-5 leading-7 text-muted">
        Si necesitas esta información para una compra o una aclaración,
        escríbenos y te respondemos directamente.
      </p>
    </article>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run components/legal
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add components/legal
git commit -m "feat(legal): render published documents and an explicit unavailable notice"
```

---

### Task 6: The eight public routes

**Files:**
- Create: `app/(legal)/layout.tsx`, `app/(legal)/legal-route.tsx`, and eight `page.tsx` files
- Test: `app/(legal)/legal-route.test.tsx`

**Interfaces:**
- Consumes: `getPublishedLegalDocument`, `LEGAL_ROUTES`, `LegalDocument`, `LegalUnavailable`
- Produces: `<LegalRoutePage type={LegalDocumentType} />`, `buildLegalMetadata(type): Metadata`

- [ ] **Step 1: Read the routing guide**

```bash
ls node_modules/next/dist/docs/
```

Read the App Router routing and metadata guides before writing any route file. This Next.js differs from training data.

- [ ] **Step 2: Write the failing test**

Create `app/(legal)/legal-route.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getPublishedLegalDocument = vi.fn();

vi.mock("@/lib/queries/legal.server", () => ({ getPublishedLegalDocument }));

afterEach(() => {
  cleanup();
  getPublishedLegalDocument.mockReset();
});

describe("LegalRoutePage", () => {
  it("renders the unavailable notice when nothing is published", async () => {
    getPublishedLegalDocument.mockResolvedValue(null);
    const { LegalRoutePage } = await import("@/app/(legal)/legal-route");

    render(await LegalRoutePage({ type: "platform_terms" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      /no hay una versión aprobada y publicada/i,
    );
  });

  it("renders the document when one is published", async () => {
    getPublishedLegalDocument.mockResolvedValue({
      id: "b1", type: "platform_terms", version: 1, title: "Términos y condiciones",
      sections: [{ id: "objeto", heading: "Objeto", paragraphs: ["Texto."] }],
      issuerIdentity: null, contentHash: "hash",
      effectiveAt: "2026-09-01T00:00:00.000Z", publishedAt: "2026-08-30T00:00:00.000Z",
    });
    const { LegalRoutePage } = await import("@/app/(legal)/legal-route");

    render(await LegalRoutePage({ type: "platform_terms" }));

    expect(screen.getByRole("heading", { level: 2, name: "Objeto" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps an unpublished document out of search results", async () => {
    getPublishedLegalDocument.mockResolvedValue(null);
    const { buildLegalMetadata } = await import("@/app/(legal)/legal-route");

    const metadata = await buildLegalMetadata("platform_terms");

    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("indexes a published document", async () => {
    getPublishedLegalDocument.mockResolvedValue({
      id: "b1", type: "platform_terms", version: 1, title: "Términos y condiciones",
      sections: [], issuerIdentity: null, contentHash: "hash",
      effectiveAt: "2026-09-01T00:00:00.000Z", publishedAt: "2026-08-30T00:00:00.000Z",
    });
    const { buildLegalMetadata } = await import("@/app/(legal)/legal-route");

    const metadata = await buildLegalMetadata("platform_terms");

    expect(metadata.title).toBe("Términos y condiciones");
    expect(metadata.robots).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run "app/(legal)"
```

Expected: FAIL — cannot resolve `@/app/(legal)/legal-route`.

- [ ] **Step 4: Write the shared route component**

Create `app/(legal)/legal-route.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal/legal-document";
import { LegalUnavailable } from "@/components/legal/legal-unavailable";
import { LEGAL_ROUTES, type LegalDocumentType } from "@/lib/legal/document-types";
import { getPublishedLegalDocument } from "@/lib/queries/legal.server";

function findRoute(type: LegalDocumentType) {
  return LEGAL_ROUTES.find((route) => route.type === type);
}

export async function buildLegalMetadata(type: LegalDocumentType): Promise<Metadata> {
  const route = findRoute(type);
  if (!route) return {};

  const document = await getPublishedLegalDocument(type);

  // An unpublished document is a configuration failure, not content. Keeping it
  // out of the index stops a crawler from surfacing the notice as if it were
  // the policy itself.
  if (!document) {
    return { title: route.title, robots: { index: false, follow: false } };
  }

  return { title: document.title };
}

export async function LegalRoutePage({ type }: { type: LegalDocumentType }) {
  const route = findRoute(type);
  if (!route) notFound();

  const document = await getPublishedLegalDocument(type);

  return document ? (
    <LegalDocument document={document} />
  ) : (
    <LegalUnavailable route={route} />
  );
}
```

- [ ] **Step 5: Write the layout**

Create `app/(legal)/layout.tsx`:

```tsx
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 print:px-0 print:py-0">
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Write the eight pages**

Create each file with only the type changed. `app/(legal)/terminos/page.tsx`:

```tsx
import { LegalRoutePage, buildLegalMetadata } from "@/app/(legal)/legal-route";

export const generateMetadata = () => buildLegalMetadata("platform_terms");

export default function Page() {
  return <LegalRoutePage type="platform_terms" />;
}
```

Repeat for the remaining seven, each with its own directory and type:

| Directory | Type |
|---|---|
| `app/(legal)/privacidad/page.tsx` | `privacy_notice` |
| `app/(legal)/compras-y-devoluciones/page.tsx` | `returns_policy` |
| `app/(legal)/garantias/page.tsx` | `warranty_policy` |
| `app/(legal)/envios/page.tsx` | `shipping_policy` |
| `app/(legal)/seguridad/page.tsx` | `security_guidance` |
| `app/(legal)/quejas-y-aclaraciones/page.tsx` | `complaints_policy` |
| `app/(legal)/terminos-vendedores/page.tsx` | `seller_terms` |

- [ ] **Step 7: Add print styles**

Append to `app/globals.css`:

```css
@media print {
  header[data-site-header],
  footer[data-site-footer] {
    display: none;
  }

  body {
    background: #ffffff;
    color: #000000;
  }

  a[href^="/"]::after {
    content: " (plazavolcanes.com" attr(href) ")";
    font-size: 0.8em;
  }
}
```

Add `data-site-header` to the root element of `components/layout/site-header.tsx` and `data-site-footer` to the `<footer>` in `components/layout/site-footer.tsx`.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npx vitest run "app/(legal)"
npm run typecheck
```

Expected: PASS, 4 tests; typecheck clean.

- [ ] **Step 9: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000/terminos` and each of the other seven. Each shows the unavailable notice, since nothing is published. Check at 390 px and desktop width, and print-preview one.

- [ ] **Step 10: Commit**

```bash
git add "app/(legal)" app/globals.css components/layout
git commit -m "feat(legal): add eight public policy routes"
```

---

### Task 7: Footer, sitemap and robots

**Files:**
- Modify: `components/layout/site-footer.tsx`, `app/sitemap.ts`, `app/robots.ts`
- Test: `components/layout/site-footer.test.tsx` (create), `app/sitemap.test.ts` (modify)

**Interfaces:**
- Consumes: `LEGAL_ROUTES`
- Produces: nothing new

- [ ] **Step 1: Write the failing footer test**

Create `components/layout/site-footer.test.tsx`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/layout/site-footer";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

afterEach(cleanup);

describe("SiteFooter", () => {
  it("exposes every legal route", () => {
    render(<SiteFooter />);

    const legal = screen.getByRole("navigation", { name: "Información legal" });

    for (const route of LEGAL_ROUTES) {
      expect(
        within(legal).getByRole("link", { name: route.navLabel }),
      ).toHaveAttribute("href", route.path);
    }
  });

  it("keeps the existing browse links", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Explorar" })).toHaveAttribute("href", "/");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run components/layout/site-footer.test.tsx
```

Expected: FAIL — no navigation named "Información legal".

- [ ] **Step 3: Add the legal column to the footer**

In `components/layout/site-footer.tsx`, import the registry and add a navigation block beside the existing links:

```tsx
import Link from "next/link";

import { VolcanoMark } from "@/components/brand/volcano-mark";
import { LEGAL_ROUTES } from "@/lib/legal/document-types";

export function SiteFooter() {
  return (
    <footer className="overflow-hidden bg-brand text-white" data-site-footer>
      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-10 px-5 py-12 sm:px-8 lg:flex-row lg:justify-between lg:px-12">
        <VolcanoMark className="absolute -bottom-20 left-1/2 w-[720px] -translate-x-1/2 text-white/5" />
        <div className="relative">
          <p className="font-display text-2xl font-semibold">Plaza Volcanes</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-white/70">
            Un punto de encuentro para tiendas independientes y personas curiosas.
          </p>
        </div>
        <div className="relative flex flex-col gap-8 sm:flex-row sm:gap-16">
          <nav aria-label="Navegación" className="flex flex-col gap-3 text-sm font-medium text-white/80">
            <Link className="hover:text-accent" href="/">Explorar</Link>
            <Link className="hover:text-accent" href="/registro">Crear tienda</Link>
            <Link className="hover:text-accent" href="/ingresar">Ingresar</Link>
          </nav>
          <nav aria-label="Información legal" className="flex flex-col gap-3 text-sm font-medium text-white/80">
            {LEGAL_ROUTES.map((route) => (
              <Link className="hover:text-accent" href={route.path} key={route.path}>
                {route.navLabel}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/55">
        © 2026 Plaza Volcanes
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Run the footer test to verify it passes**

```bash
npx vitest run components/layout/site-footer.test.tsx
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Add the routes to the sitemap**

In `app/sitemap.ts`, import `LEGAL_ROUTES` and append after the state entries:

```ts
    ...LEGAL_ROUTES.map((route) => ({
      url: buildSiteUrl(route.path),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
```

- [ ] **Step 6: Extend the sitemap test**

Open `app/sitemap.test.ts` and add:

```ts
  it("lists every legal route", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    for (const route of LEGAL_ROUTES) {
      expect(urls).toContain(buildSiteUrl(route.path));
    }
  });
```

Import `LEGAL_ROUTES` from `@/lib/legal/document-types` at the top of that file. Match the existing describe block's mocking setup rather than inventing a new one.

- [ ] **Step 7: Confirm robots keeps the routes crawlable**

Read `app/robots.ts`. The eight legal paths must NOT appear in `PRIVATE_PATHS`. Confirm none of `/terminos`, `/privacidad`, `/compras-y-devoluciones`, `/garantias`, `/envios`, `/seguridad`, `/quejas-y-aclaraciones`, `/terminos-vendedores` is prefixed by an existing entry. No change is needed; verify by running:

```bash
npx vitest run app/robots.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run the whole suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/layout/site-footer.tsx components/layout/site-footer.test.tsx app/sitemap.ts app/sitemap.test.ts
git commit -m "feat(legal): publish policy links in the footer and sitemap"
```

---

### Task 8: Build gate

**Files:**
- Create: `scripts/legal-verify.mjs`, `docs/legal/launch-state.json`, `scripts/legal-verify.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `LEGAL_DOCUMENT_TYPES` and `PLATFORM_IDENTITY_VARS` — re-declared inside the script, because it is plain Node with no TypeScript loader. Step 6 adds a test that fails if the copies drift, which is also what gives `lib/legal/platform-identity.ts` a consumer in this plan; its other consumer, the admin publish action, lands in plan 2.
- Produces: `npm run legal:verify`

- [ ] **Step 1: Write the launch-state declaration**

Create `docs/legal/launch-state.json`:

```json
{
  "status": "pre_launch",
  "owner": "unassigned — see Q1 in the design spec",
  "reason": "Mexican consumer and privacy counsel is not engaged; no legal document has been drafted, approved or published.",
  "reviewed_on": "2026-08-26",
  "acknowledged_unpublished": [
    "platform_terms",
    "privacy_notice",
    "returns_policy",
    "warranty_policy",
    "shipping_policy",
    "security_guidance",
    "complaints_policy",
    "seller_terms",
    "buyer_terms",
    "marketplace_role"
  ]
}
```

- [ ] **Step 2: Write the gate**

Create `scripts/legal-verify.mjs`:

```js
#!/usr/bin/env node
// Fails the build when a required legal document has no approved, published
// version — unless docs/legal/launch-state.json declares pre_launch and
// acknowledges exactly which types are missing. The declaration is checked in
// so the decision is reviewable, rather than an environment flag that behaves
// one way locally and another in production.

import { readFile } from "node:fs/promises";
import process from "node:process";

const REQUIRED_TYPES = [
  "platform_terms", "privacy_notice", "returns_policy", "warranty_policy",
  "shipping_policy", "security_guidance", "complaints_policy", "seller_terms",
  "buyer_terms", "marketplace_role",
];

const IDENTITY_VARS = [
  "PLAZA_LEGAL_ENTITY_NAME", "PLAZA_LEGAL_RFC", "PLAZA_LEGAL_ADDRESS",
  "PLAZA_LEGAL_EMAIL", "PLAZA_LEGAL_PHONE", "PLAZA_LEGAL_ATTENTION_HOURS",
  "PLAZA_PRIVACY_CONTACT",
];

function fail(lines) {
  console.error("\n✗ legal:verify\n");
  for (const line of lines) console.error(`  ${line}`);
  console.error("\nBuild aborted.\n");
  process.exit(1);
}

async function readLaunchState() {
  try {
    return JSON.parse(await readFile("docs/legal/launch-state.json", "utf8"));
  } catch {
    return null;
  }
}

async function readPublishedTypes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;

  // Published versions are readable by anon, so the publishable key is enough
  // and no secret is introduced into the build environment.
  const endpoint =
    `${url}/rest/v1/legal_document_versions` +
    `?select=document_type&status=eq.published&effective_at=lte.${new Date().toISOString()}`;

  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) return null;
  const rows = await response.json();
  // A 200 carrying a non-array body (a PostgREST error object, a content
  // negotiation surprise) must degrade like an unreachable database, not throw
  // a raw stack trace out of the gate.
  if (!Array.isArray(rows)) return null;
  return new Set(rows.map((row) => row.document_type));
}

const launchState = await readLaunchState();
const missingVars = IDENTITY_VARS.filter((name) => !process.env[name]?.trim());

// Registry drift is a code bug, not a launch-state condition, so it is checked
// FIRST and fails regardless of pre_launch. It must not sit behind the
// published-versions lookup: that lookup exits early when the database is
// unreachable, which is the path a build takes whenever it points at a project
// the legal migrations have not been applied to — exactly when drift would go
// unnoticed.
const seeded = await readSeededTypes(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

if (seeded) {
  const seededRequired = seeded.filter((row) => row.is_required).map((row) => row.type).sort();
  const expected = [...REQUIRED_TYPES].sort();
  const drifted =
    seededRequired.length !== expected.length ||
    seededRequired.some((type, index) => type !== expected[index]);

  if (drifted) {
    fail([
      "the legal document registry disagrees with the database seed:",
      `  code:     ${expected.join(", ")}`,
      `  database: ${seededRequired.join(", ")}`,
      "",
      "reconcile lib/legal/document-types.ts with the migration seed.",
    ]);
  }
} else {
  // Silence here would let a maintainer believe drift protection ran.
  console.warn("⚠ legal:verify  registry drift check skipped — legal_documents unreadable");
}

const published = await readPublishedTypes();

// Real drift protection for the registry: the TypeScript list and the
// migration seed are two copies of the same truth, and only this check
// reconciles them against the database itself.
async function readSeededTypes(url, key) {
  const response = await fetch(`${url}/rest/v1/legal_documents?select=type,is_required`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows : null;
}

if (published === null) {
  const detail = "cannot reach the database to check published legal documents";
  if (launchState?.status === "pre_launch") {
    console.warn(`\n⚠ legal:verify  ${detail} (pre_launch, continuing)\n`);
    process.exit(0);
  }
  fail([detail, "set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]);
}

const unpublished = REQUIRED_TYPES.filter((type) => !published.has(type));

if (unpublished.length === 0 && missingVars.length === 0) {
  console.log(`✓ legal:verify  ${REQUIRED_TYPES.length} required documents published`);
  process.exit(0);
}

if (launchState?.status === "pre_launch") {
  const acknowledgedList = launchState.acknowledged_unpublished ?? [];
  if (!Array.isArray(acknowledgedList)) {
    fail(["acknowledged_unpublished in docs/legal/launch-state.json must be an array"]);
  }
  const acknowledged = new Set(acknowledgedList);
  const unacknowledged = unpublished.filter((type) => !acknowledged.has(type));

  if (unacknowledged.length > 0) {
    fail([
      "pre_launch is declared but these types are not acknowledged:",
      ...unacknowledged.map((type) => `  ${type}`),
      "",
      "add them to acknowledged_unpublished in docs/legal/launch-state.json",
    ]);
  }

  console.warn(
    `\n⚠ legal:verify  pre_launch — ${unpublished.length} of ` +
      `${REQUIRED_TYPES.length} documents unpublished, ` +
      `${missingVars.length} identity variables unset. No document can be ` +
      `published or accepted.\n`,
  );
  process.exit(0);
}

fail([
  ...unpublished.map((type) => `${type.padEnd(20)} no approved published version`),
  ...missingVars.map((name) => `${name.padEnd(20)} not configured`),
  "",
  `${unpublished.length} of ${REQUIRED_TYPES.length} required document types unpublished.`,
]);
```

- [ ] **Step 3: Wire it into the build**

In `package.json`, change the `build` and add `legal:verify`:

```json
    "build": "node scripts/legal-verify.mjs && next build",
    "legal:verify": "node scripts/legal-verify.mjs",
```

- [ ] **Step 4: Verify the pre-launch path passes**

```bash
npm run legal:verify
```

Expected: exit 0, printing `⚠ legal:verify  pre_launch — 10 of 10 documents unpublished, 7 identity variables unset. No document can be published or accepted.`

The message deliberately does not say checkout is blocked: that enforcement
lands in plan 4, and a build message must not claim a guarantee the code does
not yet make.

- [ ] **Step 5: Verify the launched path fails**

```bash
node -e "const f='docs/legal/launch-state.json';const s=require('fs');const j=JSON.parse(s.readFileSync(f));j.status='launched';s.writeFileSync('/tmp/ls.json',JSON.stringify(j));"
cp docs/legal/launch-state.json /tmp/launch-state.backup.json
cp /tmp/ls.json docs/legal/launch-state.json
npm run legal:verify; echo "exit: $?"
cp /tmp/launch-state.backup.json docs/legal/launch-state.json
```

Expected: exit 1, listing all ten unpublished types. Confirm the file is restored to `pre_launch` afterwards with `git diff docs/legal/launch-state.json` showing nothing.

- [ ] **Step 6: Keep the duplicated lists honest**

The gate runs before any TypeScript is compiled, so it cannot import the
registry. Two copies of a list is a drift bug waiting to happen, so test it.

Create `scripts/legal-verify.test.ts`:

```ts
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { REQUIRED_LEGAL_TYPES } from "@/lib/legal/document-types";
import { PLATFORM_IDENTITY_VARS } from "@/lib/legal/platform-identity";

function readArray(source: string, name: string): string[] {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`${name} not found in scripts/legal-verify.mjs`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

describe("legal-verify", () => {
  it("checks exactly the document types the registry requires", async () => {
    const source = await readFile("scripts/legal-verify.mjs", "utf8");

    expect(readArray(source, "REQUIRED_TYPES").sort()).toEqual(
      [...REQUIRED_LEGAL_TYPES].sort(),
    );
  });

  it("checks exactly the identity variables the config requires", async () => {
    const source = await readFile("scripts/legal-verify.mjs", "utf8");

    expect(readArray(source, "IDENTITY_VARS").sort()).toEqual(
      [...PLATFORM_IDENTITY_VARS].sort(),
    );
  });
});
```

Run it:

```bash
npx vitest run scripts/legal-verify.test.ts
```

Expected: PASS, 2 tests. If it fails, the script and the registry disagree —
fix whichever is wrong, never loosen the test.

Note what this does and does not cover. These two tests keep the script's
copies of the lists in step with the TypeScript modules. The **database** seed
is reconciled separately, by the drift check inside the script itself, which
runs against the real `legal_documents` table at build time. Neither a unit
test nor pgTAP can do that job: the first has no database, the second cannot
read TypeScript.

- [ ] **Step 7: Verify the full build still succeeds**

```bash
npm run build
```

Expected: the gate warns, then `next build` completes.

- [ ] **Step 8: Commit**

```bash
git add scripts/legal-verify.mjs scripts/legal-verify.test.ts docs/legal/launch-state.json package.json
git commit -m "feat(legal): gate the production build on published legal documents"
```

---

### Task 9: Remove the unsupported claims

**Files:**
- Modify: `lib/trust-markers.ts`, `lib/trust-markers.test.ts`, `components/shops/trust-badges.tsx`, `components/shops/trust-badges.test.tsx`, `components/orders/buyer-trust-card.tsx`, `components/home/trust-strip.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `generateVerificationMarker` and `VerificationLevel` are **deleted** from `lib/trust-markers.ts`. `TrustBadges` takes `profile: { joinedOn: string } | null` — the `verificationLevel` field is gone.

- [ ] **Step 1: Write the failing test**

Add to `components/shops/trust-badges.test.tsx`:

```tsx
  it("shows no verification badge, because no verification process exists", () => {
    render(<TrustBadges metrics={fullMetrics} profile={{ joinedOn: "2026-02-01" }} />);

    const list = screen.getByRole("list", { name: "Marcadores de confianza" });

    expect(within(list).queryByTestId("trust-badge-verification")).toBeNull();
    expect(list.textContent).not.toMatch(/verificad/i);
  });
```

Change the existing `profile` constant in that file to `{ joinedOn: "2026-02-01" }` and update the badge-count assertion from `PUBLIC_TRUST_MARKERS.length + 2` to `PUBLIC_TRUST_MARKERS.length + 1`.

Add to `components/home/trust-strip.test.tsx` (create it):

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TrustStrip } from "@/components/home/trust-strip";

afterEach(cleanup);

describe("TrustStrip", () => {
  it("promises no arbitration, because the platform holds no money", () => {
    const { container } = render(<TrustStrip />);

    expect(container.textContent).not.toMatch(/arbitraje/i);
  });

  it("links the claims process instead of describing an outcome", () => {
    render(<TrustStrip />);

    expect(
      screen.getByRole("link", { name: /quejas y aclaraciones/i }),
    ).toHaveAttribute("href", "/quejas-y-aclaraciones");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run components/shops/trust-badges.test.tsx components/home/trust-strip.test.tsx
```

Expected: FAIL — the verification badge still renders and "arbitraje" is still present.

- [ ] **Step 3: Delete the verification markers**

In `lib/trust-markers.ts`, delete the `VerificationLevel` type, the `verificationMarkers` constant and `generateVerificationMarker`. Leave `generateMemberSinceMarker` untouched. Add at the top of the file:

```ts
// There is no verification marker here on purpose. `user_trust_profiles
// .verification_level` defaults to 'unverified' and nothing writes it, so any
// badge derived from it asserts a review that never happened — which LFPC
// art. 32 forbids. A marker returns when a review workflow exists to back it.
```

Delete the corresponding `generateVerificationMarker` describe block from `lib/trust-markers.test.ts`.

- [ ] **Step 4: Drop the badge**

In `components/shops/trust-badges.tsx`: remove the `generateVerificationMarker` and `VerificationLevel` imports, change `type TrustProfile` to `{ joinedOn: string }`, delete the `verification` constant and the `verification` entry in the returned array, and remove the now-unused `BadgeCheck` import.

In `app/tiendas/[slug]/page.tsx:80`, remove the `verificationLevel: shop.trust_profile.verification_level,` line from the `profile` prop.

In `components/orders/buyer-trust-card.tsx:107`, delete the `<IdentityMarker ... label="Verificación" ... />` element and remove `BadgeCheck` from the lucide import if nothing else uses it.

- [ ] **Step 5: Rewrite the trust strip signal**

In `components/home/trust-strip.tsx`, replace the fourth signal object with:

```tsx
  {
    icon: Scale,
    title: "Un canal para reclamar",
    description:
      "Si algo sale mal, abres una aclaración con tu descripción de lo ocurrido. El vendedor puede responder y administración puede registrar una resolución. Plaza Volcanes no retiene el pago ni obliga a un reembolso.",
    href: "/quejas-y-aclaraciones",
    linkLabel: "Quejas y aclaraciones",
  },
```

Add `href?: string` and `linkLabel?: string` handling in the render, after the description paragraph:

```tsx
              {signal.href ? (
                <Link
                  className="mt-2 inline-block text-sm font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
                  href={signal.href}
                >
                  {signal.linkLabel}
                </Link>
              ) : null}
```

Import `Link` from `next/link` at the top.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run components/shops components/home lib/trust-markers.test.ts
npm run typecheck
```

Expected: PASS; typecheck clean. If typecheck reports `verification_level` unused in a query selection, leave the column selected — a later plan retires it.

- [ ] **Step 7: Verify in the browser**

```bash
npm run dev
```

Open the home page and a public shop page. No "verificado" text appears; the fourth trust signal links to `/quejas-y-aclaraciones`.

- [ ] **Step 8: Commit**

```bash
git add lib/trust-markers.ts lib/trust-markers.test.ts components/shops components/orders/buyer-trust-card.tsx components/home "app/tiendas"
git commit -m "fix(trust): remove verification and arbitration claims nothing backs"
```

---

### Task 10: Guard against the claims returning

**Files:**
- Create: `tests/claims-audit.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Write the test**

Create `tests/claims-audit.test.ts`:

```ts
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { describe, expect, it } from "vitest";

// Claims the product may not make without a documented programme and evidence
// behind them. LFPC art. 32 requires information to be veraz y comprobable;
// each of these was live once and removed. See the design spec §3.
const FORBIDDEN = [
  "compra protegida",
  "pago seguro",
  "garantizado",
  "vendedor verificado",
  "altamente verificado",
  "sin riesgo",
  "arbitraje",
  "cumplimiento profeco",
  "concilianet",
];

const TRACKERS = ["googletagmanager", "gtag(", "next/script", "hotjar", "posthog", "facebook.net"];

const ROOTS = ["app", "components", "lib"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      if (!EXTENSIONS.has(extname(entry.name))) return [];
      // Test files legitimately name the forbidden strings in order to assert
      // their absence.
      if (entry.name.includes(".test.")) return [];
      return [path];
    }),
  );

  return nested.flat();
}

describe("claims audit", () => {
  it("makes no claim the platform cannot evidence", async () => {
    const files = (await Promise.all(ROOTS.map(sourceFiles))).flat();
    const offences: string[] = [];

    for (const file of files) {
      const contents = (await readFile(file, "utf8")).toLowerCase();
      for (const claim of FORBIDDEN) {
        if (contents.includes(claim)) offences.push(`${file}: "${claim}"`);
      }
    }

    expect(offences).toEqual([]);
  });

  it("loads no third-party tracking", async () => {
    const files = (await Promise.all(ROOTS.map(sourceFiles))).flat();
    const offences: string[] = [];

    for (const file of files) {
      const contents = (await readFile(file, "utf8")).toLowerCase();
      for (const tracker of TRACKERS) {
        if (contents.includes(tracker)) offences.push(`${file}: "${tracker}"`);
      }
    }

    expect(offences).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

```bash
npx vitest run tests/claims-audit.test.ts
```

Expected: PASS. If it fails, the listed file still carries a removed claim — fix the source, never the list.

- [ ] **Step 3: Run every gate**

```bash
npm test
npm run lint
npm run typecheck
npm run build
npx supabase test db
```

Expected: all pass. Report the exact output; a failing gate is reported as failing.

- [ ] **Step 4: Commit**

```bash
git add tests/claims-audit.test.ts
git commit -m "test(legal): fail the suite if a removed claim returns"
```

---

## Definition of done

- Eight public policy routes render an explicit configuration notice, are reachable without an account, work at 390 px and desktop, and print.
- No draft or approved version is readable by an anonymous visitor; pgTAP proves it.
- A published version cannot be edited or deleted; pgTAP proves it.
- Only an admin can publish, only an approved version can be published, and publishing records the approver and an audit event.
- `npm run build` runs the gate; it warns under the checked-in `pre_launch` declaration and fails once that declaration says `launched`.
- The footer exposes all eight routes and the sitemap lists them.
- No shipped file contains "vendedor verificado", "arbitraje" or any other forbidden claim, and a test fails if one returns.

## Not in this plan

Consent evidence (plan 2), seller compliance identity (plan 3), checkout disclosure and receipts (plan 4), complaints and ARCO (plan 5). Drafting the Spanish content of any document — counsel is not engaged, and this plan seeds types, never text.
