# Consent Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record immutable evidence of which legal document version a person accepted, where, and when — plus separately revocable optional consent and an 18+ attestation — without collecting a birth date or bundling unrelated permissions.

**Architecture:** Three stores with three different mutability rules. `legal_acceptances` is append-only evidence whose writer resolves the document version server-side, so a forged version id has nowhere to arrive. `consent_preferences` is revocable state whose *absence* means "not granted", making "defaults unchecked" a property of the schema rather than a checkbox prop. `age_attestations` records a self-declaration and no date of birth. All three are written only by `security definer` RPCs; no client role holds DML.

**Tech Stack:** Supabase Postgres with RLS, pgTAP, Next.js 16 App Router server actions, React 19, zod 4, Vitest + Testing Library, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-26-legal-privacy-consent-design.md` — §4.2 (consent), §5 (routes), §6.1 (checkout, for the interface this must expose), §13 (tests 6–10).

**Predecessor:** `docs/superpowers/plans/2026-08-26-legal-content-system.md` (plan 1, complete). Read `docs/legal/plan-1-handoff.md` before starting — Tasks 1–3 below exist because of it.

---

## Global Constraints

- **This is NOT the Next.js you know.** Read the relevant guide in `node_modules/next/dist/docs/` before writing route, action or metadata code. `AGENTS.md` is written by `next dev`; commit it with your work rather than reverting it.
- **Migration filenames come from `npx supabase migration new <name>`.** Never hand-invent a timestamp.
- **`lib/database.types.ts` is hand-maintained here — do NOT run `supabase gen types` over it.** It carries a bespoke `OrderStatus` union and seventeen exported row aliases that a dozen modules import; regenerating deletes them. Add entries by hand in the file's existing compressed single-line style. Generate into `/tmp/generated-types.ts` to check your entries against the real schema.
- **Local database only.** Never `db push`, never `db reset --linked`, never any command targeting the linked project.
- **RLS on every new table.** Ownership predicates use `(select auth.uid())`. Every `UPDATE` policy carries both `USING` and `WITH CHECK`.
- **No client role gets DML on the new tables.** Copy the grant shape plan 1 established: `revoke all ... from public, anon, authenticated`, `grant select` only where a person must read their own rows, and let a `security definer` RPC be the only writer. `service_role` gets **no** DML either — plan 1's ruling R7 established that the grant, not a trigger, is the boundary.
- **Definer functions** live where plan 1 put them, carry `set search_path = ''`, are revoked from `public, anon`, granted narrowly, and perform an explicit authorization check.
- **All user-facing copy is Spanish (es-MX)**, accents included. SQL exception messages are Spanish. Code and comments are English.
- **No new runtime dependencies.**
- **Never write legal text.** This plan records acceptance *of* documents; it never authors one. No policy language in any file.
- **No unsupported claims.** These strings must not appear in shipped code: `compra protegida`, `pago seguro`, `garantizado`, `vendedor verificado`, `altamente verificado`, `sin riesgo`, `arbitraje`, `cumplimiento PROFECO`, `Concilianet`. `tests/claims-audit.test.ts` enforces this and Task 2 extends it to migrations.
- **Never collect a date of birth.** LFPDPPP art. 12 requires minimisation; the age control is a self-declaration and nothing more.
- **Optional consent is never a precondition for service.** Nothing in the purchase, registration or shop-creation path may read `consent_preferences`. LFPC art. 18 BIS.
- **Commit after every task**, Conventional Commits, ending each message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

---

## Execution prerequisite — clear this before Task 1

`npx supabase test db` currently **fails**, and not because of this work. The
local Docker database is shared with another session, carries migration
`20260826120000` (which this branch does not have), and holds leftover rows
producing `duplicate key value violates unique constraint "shops_pkey"`. Twelve
unrelated pgTAP files abort on it.

This plan is mostly database work and its verification is mostly pgTAP. Running
it against that database would repeat plan 1's problem, where a whole suite
could not be trusted.

**Before starting, confirm with the human partner that `npx supabase db reset`
may be run**, and that the other session's uncommitted work is committed or
stashed first. Then run it and confirm the suite is green:

```bash
npx supabase db reset
npx supabase test db
```

Expected: every file passes. If it does not, stop and report — a red baseline
makes every later failure ambiguous. Do not start Task 1 against a red suite.

---

## The decision that shapes this plan

`legal_acceptances.document_version_id` and `age_attestations.terms_version_id`
are `not null` foreign keys to `legal_document_versions`. **Nothing is
published**, because counsel is not engaged. So there is literally nothing to
accept, and there will not be until a document is approved and published.

Registration must keep working in the meantime. The resolution, which mirrors
how plan 1's routes already behave:

- While a required document has **no published version**, the acceptance
  checkbox is **not rendered**, no acceptance row is written, and registration
  proceeds. There is nothing to accept, so asking someone to accept it would be
  the dishonest option.
- Once a required document **is** published, the checkbox appears, is required,
  and registration is refused without it.
- `public.record_acceptances` raises when asked to record a type with no
  published version, so the database never invents one.
- `public.required_acceptance_documents()` returns the published required
  documents a surface must display. An empty result is the current, correct
  state and every surface must handle it.

This also means **acceptance is not atomic with registration.** Supabase Auth
creates the user through its own API, so the acceptance write is necessarily a
second statement. Task 8 handles the gap explicitly: acceptance is recorded
immediately after sign-up, and `public.pending_acceptances(p_user)` is the
durable backstop that catches anyone who slipped through — the same function
that drives re-acceptance after a material change. Do not attempt a trigger on
`auth.users`; it cannot see a checkbox.

---

## File Structure

**Created — database**

| File | Responsibility |
|---|---|
| `supabase/migrations/<ts>_enforce_single_published_version.sql` | Partial unique index; publish reordered to retire-then-publish |
| `supabase/migrations/<ts>_retire_buyer_verification_claim.sql` | Stops `evaluate_buyer_trust` emitting the verification marker |
| `supabase/migrations/<ts>_add_legal_draft_workflow.sql` | `create_legal_draft`, `approve_legal_version` — the missing write path |
| `supabase/migrations/<ts>_add_consent_evidence.sql` | `legal_acceptances`, immutability, `record_acceptances`, `pending_acceptances`, `required_acceptance_documents` |
| `supabase/migrations/<ts>_add_consent_preferences.sql` | `consent_preferences`, `consent_preference_events`, `set_consent_preference` |
| `supabase/migrations/<ts>_add_age_attestations.sql` | `age_attestations`, `record_age_attestation` |
| `supabase/tests/database/legal_draft_workflow.test.sql` | Draft/approve authorization and state machine |
| `supabase/tests/database/consent_evidence.test.sql` | Immutability, forgery resistance, pending logic |
| `supabase/tests/database/consent_preferences.test.sql` | Absence means not granted; withdrawal recorded |
| `supabase/tests/database/age_attestations.test.sql` | One per user; no birth date column exists |

**Created — application**

| File | Responsibility |
|---|---|
| `lib/queries/consent.server.ts` | Read required documents and pending acceptances |
| `lib/actions/consent.ts` | Server actions: record acceptance, set preference |
| `lib/validation/consent.ts` | zod schemas for the consent form fields |
| `components/consent/acceptance-checkbox.tsx` | One required checkbox listing each document with its own link |
| `components/consent/marketing-preference.tsx` | Optional, unchecked, revocable toggle |
| `components/consent/age-confirmation.tsx` | 18+ self-declaration |
| `app/cuenta/privacidad/page.tsx` | Where a person reviews and withdraws optional consent |

**Modified**

| File | Change |
|---|---|
| `lib/database.types.ts` | Hand-add the three tables and five functions |
| `lib/trust-markers.ts`, `lib/buyer-trust.ts` | Drop the verification field (Task 2) |
| `tests/claims-audit.test.ts` | Extend the scan to `supabase/migrations/*.sql` (Task 2) |
| `components/auth/auth-form.tsx`, `lib/actions/auth.ts`, `lib/validation/auth.ts` | Registration acceptance + age (Task 8) |
| `components/shops/shop-form.tsx`, `lib/actions/shops.ts` | Seller terms acceptance (Task 9) |
| `components/layout/site-footer.tsx` | Link `/cuenta/privacidad` (Task 10) |

---

### Task 1: One published version per document type

Plan 1's final review found that two concurrent publishes can leave two rows
`published` for the same type. The resolver's tiebreak is deterministic, so
nothing breaks visibly — but Task 4's `record_acceptances` resolves "the current
published version" and would be recording evidence against an ambiguous set.
Fix it before anything depends on it.

**Files:**
- Create: `supabase/migrations/<generated>_enforce_single_published_version.sql`
- Modify: `supabase/tests/database/legal_documents.test.sql`

**Interfaces:**
- Consumes: `public.publish_legal_version(uuid, jsonb)` from plan 1
- Produces: the same function, reordered; an invariant later tasks may rely on — at most one `published` row per `document_type`

- [ ] **Step 1: Write the failing test**

Append to `supabase/tests/database/legal_documents.test.sql`, before `finish()`,
and raise `plan(N)` by 2:

```sql
-- Two published rows for one type must be impossible, however they arrive.
select throws_ok(
  $$insert into public.legal_document_versions
      (document_type, version, status, title, body, content_hash, issuer_identity,
       change_summary, effective_at, published_at, approved_by, approved_at)
    values ('privacy_notice', 99, 'published', 'Duplicada',
            '{"sections": []}'::jsonb, 'hash', '{"entityName":"X"}'::jsonb,
            'duplicada', now(), now(), 'Lic. Prueba', now())$$,
  '42501', null,
  'a second published version cannot be inserted for a type that has one'
);

select results_eq(
  $$select count(*) from public.legal_document_versions
     where document_type = 'privacy_notice' and status = 'published'$$,
  array[1::bigint],
  'exactly one published version survives a supersession'
);
```

- [ ] **Step 2: Run it to verify it fails**

```bash
C=$(docker ps --format '{{.Names}}' | grep -i supabase_db | head -1)
docker exec -i "$C" psql -U postgres -d postgres -q < supabase/tests/database/legal_documents.test.sql
```

Expected: the `throws_ok` fails — the insert is currently rejected by the
guard trigger with 42501 for a different reason (INSERT of a published row is
already banned), so read the output carefully. If it passes for the wrong
reason, change the fixture to an `update` of an existing `approved` row via
`publish_legal_version` on a type that already has a published version, which
is the real concurrent-publish shape.

- [ ] **Step 3: Write the migration**

```bash
npx supabase migration new enforce_single_published_version
```

```sql
-- Task 4's record_acceptances resolves "the current published version" to write
-- acceptance evidence against. That phrase has to denote exactly one row, and
-- until now nothing enforced it: publish_legal_version published the new
-- version before retiring the old one, so two concurrent publishes could both
-- succeed and leave two rows published.

-- Retire first, publish second. With the index below, the old order would
-- deadlock against itself; this order is now required, not merely tidier.
create or replace function public.publish_legal_version(p_version_id uuid, p_issuer_identity jsonb)
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

  perform private.assert_publishable_identity(p_issuer_identity);
  perform private.assert_publishable_body(v_row.body);

  -- Lock the outgoing row before touching either, so two concurrent publishes
  -- of the same type serialise here rather than racing to the index.
  select id into v_current
  from public.legal_document_versions
  where document_type = v_row.document_type and status = 'published'
  order by effective_at desc
  limit 1
  for update;

  if v_current is not null then
    update public.legal_document_versions
    set status = 'retired', retired_at = now()
    where id = v_current;
  end if;

  update public.legal_document_versions
  set status = 'published',
      issuer_identity = p_issuer_identity,
      content_hash = encode(
        extensions.digest(v_row.body::text || p_issuer_identity::text, 'sha256'), 'hex'),
      published_at = now(),
      supersedes_version_id = v_current
  where id = p_version_id
  returning * into v_row;

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

-- The invariant itself. Partial, so retired and draft rows are unconstrained.
create unique index legal_document_versions_one_published_idx
  on public.legal_document_versions (document_type)
  where status = 'published';

-- Rollback:
-- drop index legal_document_versions_one_published_idx;
-- (and restore the previous function body from
--  20260827045523_harden_legal_publish.sql)
```

**You must first extract `private.assert_publishable_identity` and
`private.assert_publishable_body`.** The hardening migration
`20260827045523_harden_legal_publish.sql` validates the identity and body
INLINE inside `publish_legal_version`. Task 3 adds a second caller
(`create_legal_draft`) for the body validation, and two copies of a validation
rule is how the two copies drift.

So in this migration, before redefining `publish_legal_version`: read that
hardening migration, move its two validation blocks verbatim into
`private.assert_publishable_identity(p_identity jsonb)` and
`private.assert_publishable_body(p_body jsonb)` — both `language plpgsql`,
`set search_path = ''`, revoked from `public, anon, authenticated` — and call
them as the function above does. **Copy the blocks; do not rewrite them from
memory.** Their exact Spanish messages are asserted by
`legal_documents.test.sql`, and paraphrasing them fails those tests.

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker exec -i "$C" psql -U postgres -d postgres -q < supabase/tests/database/legal_documents.test.sql
docker exec -i "$C" psql -U postgres -d postgres < supabase/migrations/<generated>_enforce_single_published_version.sql
docker exec -i "$C" psql -U postgres -d postgres -q < supabase/tests/database/legal_documents.test.sql
```

Expected: all assertions pass after the migration, including the two new ones.

- [ ] **Step 5: Run the whole database suite**

```bash
npx supabase test db
```

Expected: all files pass. If `legal_documents.test.sql` now fails an older
assertion, the reorder changed observable behaviour — investigate rather than
adjusting the assertion.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations supabase/tests/database/legal_documents.test.sql
git commit -m "fix(legal): enforce one published version per document type

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Retire the buyer-side verification claim

Plan 1 removed the seller-side verification badges and the arbitration promise.
It did **not** remove the buyer-side equivalent, which is generated in SQL:
`private.evaluate_buyer_trust` still builds `'Comprador verificado'` and
`'Altamente verificado — completó verificación avanzada con documentos
oficiales'` into the buyer-trust payload. `BuyerTrustCard` stopped rendering
them, so they no longer reach a screen — but they still reach the client, and
`user_trust_profiles.verification_level` is still `'unverified'` for everyone
with nothing that writes it. It is the same unbacked claim one layer down.

This was deferred from plan 1 only because its pgTAP suite could not be run.
With the suite green, do it now — and close the gap that hid it, by teaching
the claims audit to read migrations.

**Files:**
- Create: `supabase/migrations/<generated>_retire_buyer_verification_claim.sql`
- Modify: `lib/buyer-trust.ts`, `components/orders/buyer-trust-card.tsx`, `tests/claims-audit.test.ts`, `lib/buyer-trust.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `BuyerTrustOutput` **without** a `verification_level` field

- [ ] **Step 1: Extract the current function definition — do not retype it**

```bash
C=$(docker ps --format '{{.Names}}' | grep -i supabase_db | head -1)
docker exec "$C" psql -U postgres -d postgres -tAc \
  "select pg_get_functiondef(p.oid) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'evaluate_buyer_trust';" \
  > /tmp/evaluate_buyer_trust.sql
wc -l /tmp/evaluate_buyer_trust.sql
```

This function is roughly four hundred lines. You are making two deletions in
it, not rewriting it. Reproducing it from memory would introduce silent
behaviour changes in trust scoring.

- [ ] **Step 2: Write the failing test**

Add to `tests/claims-audit.test.ts`, inside the existing describe block:

```ts
  it("makes no unbacked claim in a migration either", async () => {
    const dir = "supabase/migrations";
    const names = (await readdir(dir)).filter((name) => name.endsWith(".sql"));
    const offences: string[] = [];

    expect(names.length).toBeGreaterThan(10);

    for (const name of names) {
      const contents = (await readFile(join(dir, name), "utf8"))
        .toLowerCase()
        .replace(/\s+/g, " ");
      for (const claim of FORBIDDEN) {
        if (contents.includes(claim)) offences.push(`${dir}/${name}: "${claim}"`);
      }
    }

    expect(offences).toEqual([]);
  });
```

- [ ] **Step 3: Run it to verify it fails**

```bash
npx vitest run tests/claims-audit.test.ts
```

Expected: FAIL, naming `20260820191826_add_buyer_trust_system.sql` and
`"altamente verificado"`. That is the claim this task removes.

- [ ] **Step 4: Write the migration**

```bash
npx supabase migration new retire_buyer_verification_claim
```

Open `/tmp/evaluate_buyer_trust.sql`, and make exactly two deletions:

1. Delete the `v_verification := case p_verification_level ... end;` assignment
   block in its entirety, and the `v_verification` declaration in the `declare`
   section.
2. Delete the `'verification_level', v_verification,` pair from the
   `jsonb_build_object` that assembles the returned output.

Leave every other line byte-identical. Paste the result into the migration
under a header comment explaining why, following the style of plan 1's
migrations, and end with a rollback comment pointing at
`20260820191826_add_buyer_trust_system.sql` as the prior definition.

If the function signature takes `p_verification_level` as a parameter, leave the
parameter in place — its callers pass it and changing the signature widens this
task into a caller migration. It simply stops being used, which is honest: the
column it comes from is `'unverified'` for every account and nothing writes it.

- [ ] **Step 5: Drop the field from the TypeScript contract**

In `lib/buyer-trust.ts`, remove `verification_level` from
`buyerTrustOutputSchema`. Because the schema is `.strict()`, leaving it would
make every evaluation fail to parse once the migration lands. Remove any
`verification_level` reference from `lib/buyer-trust.test.ts` fixtures.

In `components/orders/buyer-trust-card.tsx`, confirm nothing still reads
`trust.verification_level` — plan 1 removed the rendering, so this should be a
no-op check rather than an edit.

- [ ] **Step 6: Apply and verify**

```bash
docker exec -i "$C" psql -U postgres -d postgres < supabase/migrations/<generated>_retire_buyer_verification_claim.sql
npx supabase test db
npx vitest run tests/claims-audit.test.ts lib/buyer-trust.test.ts
npm run typecheck
```

Expected: the database suite still passes in full — in particular
`buyer_trust_evaluator.test.sql`, which has 36 assertions over this function. If
any of them fail, your paste changed behaviour: diff your migration against
`/tmp/evaluate_buyer_trust.sql` and find the difference. The claims-audit test
now passes.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations lib/buyer-trust.ts lib/buyer-trust.test.ts tests/claims-audit.test.ts
git commit -m "fix(trust): stop emitting the buyer verification claim

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The draft and approval write path

`public.publish_legal_version` is currently unreachable in production: no role
holds `INSERT` on `legal_document_versions`, and nothing creates or approves a
draft. An approved row can only come from a direct database connection. Every
later task in this plan needs a published document to exist, and every one of
their tests needs a way to make one.

**Files:**
- Create: `supabase/migrations/<generated>_add_legal_draft_workflow.sql`
- Test: `supabase/tests/database/legal_draft_workflow.test.sql`

**Interfaces:**
- Consumes: `public.legal_document_versions`, `public.is_current_user_admin()`
- Produces:
  - `public.create_legal_draft(p_type text, p_title text, p_body jsonb, p_change_summary text, p_is_material boolean) returns public.legal_document_versions`
  - `public.approve_legal_version(p_version_id uuid, p_approved_by text, p_effective_at timestamptz) returns public.legal_document_versions`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/legal_draft_workflow.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'admin2@test.local', now()),
  ('c0000000-0000-4000-8000-000000000002', 'buyer2@test.local', now());

insert into private.admin_users (user_id, granted_by)
values ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001');

-- a non-admin can do neither
set local role authenticated;
set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$select public.create_legal_draft('platform_terms', 'Borrador', '{"sections": []}'::jsonb, 'primera', true)$$,
  '42501', null, 'a non-admin cannot create a draft'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.create_legal_draft('platform_terms', 'Borrador', '{"sections": [{"id": "objeto", "heading": "Objeto", "paragraphs": ["Texto."]}]}'::jsonb, 'primera version', true)$$,
  'an admin creates a draft'
);

select results_eq(
  $$select status::text from public.legal_document_versions
     where document_type = 'platform_terms' order by version desc limit 1$$,
  array['draft'::text],
  'a new draft starts in draft status'
);

select results_eq(
  $$select version from public.legal_document_versions
     where document_type = 'platform_terms' order by version desc limit 1$$,
  array[1::integer],
  'the first draft of a type is version 1'
);

select lives_ok(
  $$select public.create_legal_draft('platform_terms', 'Segundo', '{"sections": [{"id": "objeto", "heading": "Objeto", "paragraphs": ["Texto."]}]}'::jsonb, 'segunda version', false)$$,
  'a second draft is allowed'
);

select results_eq(
  $$select version from public.legal_document_versions
     where document_type = 'platform_terms' order by version desc limit 1$$,
  array[2::integer],
  'version numbers increment per type'
);

-- approval
select lives_ok(
  $$select public.approve_legal_version(
      (select id from public.legal_document_versions
        where document_type = 'platform_terms' and version = 1),
      'Lic. Prueba Aprobadora', now())$$,
  'an admin approves a draft'
);

select results_eq(
  $$select status::text from public.legal_document_versions
     where document_type = 'platform_terms' and version = 1$$,
  array['approved'::text],
  'approval moves the version to approved'
);

select throws_ok(
  $$select public.approve_legal_version(
      (select id from public.legal_document_versions
        where document_type = 'platform_terms' and version = 1),
      'Lic. Otra', now())$$,
  '22023', null,
  'a version that is not a draft cannot be approved again'
);

select throws_ok(
  $$select public.create_legal_draft('platform_terms', 'Malo', '{"sections": "no soy un arreglo"}'::jsonb, 'mala forma', true)$$,
  '22023', null,
  'a draft with a malformed body is rejected at creation'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — `function public.create_legal_draft(...) does not exist`.

- [ ] **Step 3: Write the migration**

```bash
npx supabase migration new add_legal_draft_workflow
```

```sql
-- publish_legal_version had no way to be reached: nothing created a draft and
-- nothing approved one, because no client role holds INSERT on the versions
-- table and that revocation is the security boundary. These two functions are
-- the missing half — same definer shape, same admin gate, and the body is
-- validated at creation so a malformed document cannot sit in the table waiting
-- to fail at publish time.

create or replace function public.create_legal_draft(
  p_type text,
  p_title text,
  p_body jsonb,
  p_change_summary text,
  p_is_material boolean
)
returns public.legal_document_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.legal_document_versions;
  v_next integer;
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501',
      message = 'Solo administración crea borradores legales.';
  end if;

  if not exists (select 1 from public.legal_documents where type = p_type) then
    raise exception using errcode = '22023',
      message = 'Tipo de documento desconocido.';
  end if;

  perform private.assert_publishable_body(p_body);

  select coalesce(max(version), 0) + 1 into v_next
  from public.legal_document_versions
  where document_type = p_type;

  insert into public.legal_document_versions
    (document_type, version, status, title, body, change_summary, is_material)
  values (p_type, v_next, 'draft', p_title, p_body, p_change_summary, p_is_material)
  returning * into v_row;

  insert into private.admin_audit_events (actor_id, action, metadata)
  values (auth.uid(), 'legal_draft_created',
          jsonb_build_object('version_id', v_row.id, 'document_type', p_type,
                             'version', v_next));

  return v_row;
end;
$$;

create or replace function public.approve_legal_version(
  p_version_id uuid,
  p_approved_by text,
  p_effective_at timestamptz
)
returns public.legal_document_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.legal_document_versions;
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501',
      message = 'Solo administración aprueba documentos legales.';
  end if;

  if p_approved_by is null or char_length(btrim(p_approved_by)) < 3 then
    raise exception using errcode = '22023',
      message = 'Registra quién aprueba el documento.';
  end if;

  if p_effective_at is null then
    raise exception using errcode = '22023',
      message = 'Registra la fecha de entrada en vigor.';
  end if;

  select * into v_row from public.legal_document_versions
  where id = p_version_id for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'La versión no existe.';
  end if;

  if v_row.status <> 'draft' then
    raise exception using errcode = '22023',
      message = 'Solo un borrador puede aprobarse.';
  end if;

  update public.legal_document_versions
  set status = 'approved',
      approved_by = btrim(p_approved_by),
      approved_at = now(),
      effective_at = p_effective_at
  where id = p_version_id
  returning * into v_row;

  insert into private.admin_audit_events (actor_id, action, metadata)
  values (auth.uid(), 'legal_version_approved',
          jsonb_build_object('version_id', p_version_id,
                             'approved_by', btrim(p_approved_by)));

  return v_row;
end;
$$;

alter table private.admin_audit_events
  drop constraint if exists admin_audit_events_action_check;
do $$
declare v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'private.admin_audit_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%dispute_resolved%';
  if v_name is not null then
    execute format('alter table private.admin_audit_events drop constraint %I', v_name);
  end if;
end;
$$;
alter table private.admin_audit_events
  add constraint admin_audit_events_action_check
  check (action in ('admin_granted', 'admin_revoked', 'dispute_resolved',
                    'legal_version_published', 'legal_draft_created',
                    'legal_version_approved'));

revoke all on function public.create_legal_draft(text, text, jsonb, text, boolean) from public, anon;
grant execute on function public.create_legal_draft(text, text, jsonb, text, boolean) to authenticated;
revoke all on function public.approve_legal_version(uuid, text, timestamptz) from public, anon;
grant execute on function public.approve_legal_version(uuid, text, timestamptz) to authenticated;

-- Rollback:
-- drop function public.approve_legal_version(uuid, text, timestamptz);
-- drop function public.create_legal_draft(text, text, jsonb, text, boolean);
-- (and restore the four-value action constraint)
```

**If `private.assert_publishable_body` does not exist** because Task 1 chose to
keep the validation inline, extract it into that helper as part of this task —
two callers now need it, and duplicating validation is how the two copies drift.

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker exec -i "$C" psql -U postgres -d postgres < supabase/migrations/<generated>_add_legal_draft_workflow.sql
npx supabase test db
```

Expected: all files pass, including the new `legal_draft_workflow.test.sql` at
10/10.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/database/legal_draft_workflow.test.sql
git commit -m "feat(legal): add the draft and approval write path

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Acceptance evidence

**Files:**
- Create: `supabase/migrations/<generated>_add_consent_evidence.sql`
- Test: `supabase/tests/database/consent_evidence.test.sql`

**Interfaces:**
- Consumes: `public.legal_documents`, `public.legal_document_versions`, `public.create_legal_draft`, `public.approve_legal_version`, `public.publish_legal_version`
- Produces:
  - `public.required_acceptance_documents() returns table (document_type text, version_id uuid, version integer, title text, public_path text)`
  - `public.record_acceptances(p_types text[], p_surface text, p_action text, p_order_id bigint, p_shop_id bigint) returns integer`
  - `public.pending_acceptances(p_user uuid) returns table (document_type text, version_id uuid)`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/consent_evidence.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'legal_acceptances', 'acceptance evidence exists');

insert into auth.users (id, email, created_at) values
  ('d0000000-0000-4000-8000-000000000001', 'admin3@test.local', now()),
  ('d0000000-0000-4000-8000-000000000002', 'ana@test.local', now()),
  ('d0000000-0000-4000-8000-000000000003', 'beto@test.local', now());

insert into private.admin_users (user_id, granted_by)
values ('d0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001');

-- with nothing published, there is nothing to accept
set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select count(*) from public.required_acceptance_documents()$$,
  array[0::bigint],
  'no published document means nothing is required'
);

select throws_ok(
  $$select public.record_acceptances(array['platform_terms'], 'registro', 'Crear cuenta', null, null)$$,
  '22023', null,
  'accepting a type with no published version is refused'
);
reset role;

-- publish one
set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.create_legal_draft('platform_terms', 'Términos', '{"sections": [{"id": "objeto", "heading": "Objeto", "paragraphs": ["Texto."]}]}'::jsonb, 'primera', true);
select public.approve_legal_version(
  (select id from public.legal_document_versions where document_type = 'platform_terms' order by version desc limit 1),
  'Lic. Prueba', now());
select public.publish_legal_version(
  (select id from public.legal_document_versions where document_type = 'platform_terms' order by version desc limit 1),
  '{"entityName":"Ejemplo SA","rfc":"EJE010101AB1","address":"Calle 1","email":"a@b.mx","phone":"+525512345678","attentionHours":"L-V 9-18","privacyContact":"d@b.mx"}'::jsonb);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select results_eq(
  $$select count(*) from public.required_acceptance_documents()$$,
  array[1::bigint],
  'a published required document appears in the required list'
);

select results_eq(
  $$select public.record_acceptances(array['platform_terms'], 'registro', 'Crear cuenta', null, null)$$,
  array[1::integer],
  'recording an acceptance returns how many rows it wrote'
);

select results_eq(
  $$select content_hash = (select content_hash from public.legal_document_versions
       where document_type = 'platform_terms' and status = 'published')
    from public.legal_acceptances limit 1$$,
  array[true],
  'the acceptance copies the hash from the database, not from the caller'
);

-- a person reads only their own evidence
select results_eq(
  $$select count(*) from public.legal_acceptances$$,
  array[1::bigint],
  'a signed in person sees their own acceptance'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000003", "role": "authenticated"}';
select results_eq(
  $$select count(*) from public.legal_acceptances$$,
  array[0::bigint],
  'another person sees none of it'
);
reset role;

set local role anon;
select results_eq(
  $$select count(*) from public.legal_acceptances$$,
  array[0::bigint],
  'an anonymous visitor sees none of it'
);
reset role;

-- evidence is immutable
select throws_ok(
  $$update public.legal_acceptances set surface = 'checkout'$$,
  '42501', null, 'an acceptance cannot be edited'
);

select throws_ok(
  $$delete from public.legal_acceptances$$,
  '42501', null, 'an acceptance cannot be deleted'
);

-- re-acceptance only after a material change
set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select results_eq(
  $$select count(*) from public.pending_acceptances('d0000000-0000-4000-8000-000000000002')$$,
  array[0::bigint],
  'nothing is pending right after accepting'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.create_legal_draft('platform_terms', 'Términos v2', '{"sections": [{"id": "objeto", "heading": "Objeto", "paragraphs": ["Otro."]}]}'::jsonb, 'correccion menor', false);
select public.approve_legal_version(
  (select id from public.legal_document_versions where document_type = 'platform_terms' order by version desc limit 1),
  'Lic. Prueba', now());
select public.publish_legal_version(
  (select id from public.legal_document_versions where document_type = 'platform_terms' order by version desc limit 1),
  '{"entityName":"Ejemplo SA","rfc":"EJE010101AB1","address":"Calle 1","email":"a@b.mx","phone":"+525512345678","attentionHours":"L-V 9-18","privacyContact":"d@b.mx"}'::jsonb);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "d0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select results_eq(
  $$select count(*) from public.pending_acceptances('d0000000-0000-4000-8000-000000000002')$$,
  array[0::bigint],
  'a non-material new version does not ask for re-acceptance'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.legal_acceptances" does not exist`.

- [ ] **Step 3: Write the migration**

```bash
npx supabase migration new add_consent_evidence
```

```sql
-- What a person agreed to, when, and on which screen. This is evidence, so it
-- is append-only: update and delete both raise, and the user_id is
-- `on delete restrict` because LFPDPPP art. 25 fr. I and II let a controller
-- keep exactly this after a cancellation request. Anonymisation replaces the
-- id with a pseudonym rather than deleting the row.

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  document_type text not null references public.legal_documents (type) on delete restrict,
  document_version_id uuid not null references public.legal_document_versions (id) on delete restrict,
  content_hash text not null,
  accepted_at timestamptz not null default now(),
  surface text not null check (surface in ('registro', 'checkout', 'alta_tienda', 'panel')),
  action text not null check (char_length(btrim(action)) between 2 and 120),
  order_id bigint references public.orders (id) on delete restrict,
  shop_id bigint references public.shops (id) on delete restrict
);

create index legal_acceptances_lookup_idx
  on public.legal_acceptances (user_id, document_type, accepted_at desc);

revoke all on table public.legal_acceptances from public, anon, authenticated;
-- Read-only, and only your own. The RPC below is the sole writer.
grant select on table public.legal_acceptances to authenticated;

alter table public.legal_acceptances enable row level security;

create policy own_acceptances_are_readable on public.legal_acceptances
  for select to authenticated
  using ((select auth.uid()) = user_id);

create function private.guard_legal_acceptances()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501',
    message = 'La evidencia de aceptación no se modifica ni se elimina.';
end;
$$;

revoke execute on function private.guard_legal_acceptances() from public, anon, authenticated;

create trigger guard_legal_acceptances
  before update or delete on public.legal_acceptances
  for each row execute function private.guard_legal_acceptances();

-- Which documents a surface must show. Empty is the correct answer while
-- counsel has approved nothing, and every caller must handle that.
create function public.required_acceptance_documents()
returns table (document_type text, version_id uuid, version integer, title text, public_path text)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.type, v.id, v.version, v.title, d.public_path
  from public.legal_documents d
  join lateral (
    select * from public.legal_document_versions x
    where x.document_type = d.type
      and x.status = 'published'
      and x.effective_at <= now()
    order by x.effective_at desc
    limit 1
  ) v on true
  where d.is_required
  order by d.sort_order
$$;

revoke all on function public.required_acceptance_documents() from public;
grant execute on function public.required_acceptance_documents() to anon, authenticated;

-- The writer. It takes no version id and no hash: both are resolved here from
-- the published row, so a crafted version has no parameter to arrive in.
create function public.record_acceptances(
  p_types text[],
  p_surface text,
  p_action text,
  p_order_id bigint default null,
  p_shop_id bigint default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_type text;
  v_version public.legal_document_versions;
  v_written integer := 0;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if p_types is null or array_length(p_types, 1) is null then
    raise exception using errcode = '22023', message = 'No se indicó qué documento se acepta.';
  end if;

  foreach v_type in array p_types loop
    select * into v_version
    from public.legal_document_versions
    where document_type = v_type and status = 'published' and effective_at <= now()
    order by effective_at desc
    limit 1;

    if not found then
      raise exception using errcode = '22023',
        message = format('No hay una versión publicada de %s que aceptar.', v_type);
    end if;

    insert into public.legal_acceptances
      (user_id, document_type, document_version_id, content_hash, surface, action,
       order_id, shop_id)
    values
      (v_user, v_type, v_version.id, v_version.content_hash, p_surface, p_action,
       p_order_id, p_shop_id);

    v_written := v_written + 1;
  end loop;

  return v_written;
end;
$$;

revoke all on function public.record_acceptances(text[], text, text, bigint, bigint) from public, anon;
grant execute on function public.record_acceptances(text[], text, text, bigint, bigint) to authenticated;

-- Types whose current published version postdates this person's latest
-- acceptance AND where something material changed in between. A typo fix does
-- not re-prompt the whole user base.
create function public.pending_acceptances(p_user uuid)
returns table (document_type text, version_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.document_type, r.version_id
  from public.required_acceptance_documents() r
  left join lateral (
    select max(a.accepted_at) as accepted_at
    from public.legal_acceptances a
    where a.user_id = p_user and a.document_type = r.document_type
  ) last on true
  where last.accepted_at is null
     or exists (
       select 1 from public.legal_document_versions v
       where v.document_type = r.document_type
         and v.is_material
         and v.effective_at > last.accepted_at
         and v.effective_at <= now()
         and v.status in ('published', 'retired')
     )
$$;

revoke all on function public.pending_acceptances(uuid) from public, anon;
grant execute on function public.pending_acceptances(uuid) to authenticated;

-- Rollback:
-- drop function public.pending_acceptances(uuid);
-- drop function public.record_acceptances(text[], text, text, bigint, bigint);
-- drop function public.required_acceptance_documents();
-- drop trigger guard_legal_acceptances on public.legal_acceptances;
-- drop function private.guard_legal_acceptances();
-- drop table public.legal_acceptances;
```

**Note on `pending_acceptances` and RLS:** it is `security invoker` and reads
`legal_acceptances`, whose select policy is `auth.uid() = user_id`. So it
returns meaningful results only for the caller's own id. That is intentional —
passing someone else's id returns "everything is pending" rather than leaking
what they accepted. Task 7's query layer always passes the session's own id.

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker exec -i "$C" psql -U postgres -d postgres < supabase/migrations/<generated>_add_consent_evidence.sql
npx supabase test db
```

Expected: all files pass, `consent_evidence.test.sql` at 12/12.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/database/consent_evidence.test.sql
git commit -m "feat(consent): record immutable acceptance evidence

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Optional consent, revocable

**Files:**
- Create: `supabase/migrations/<generated>_add_consent_preferences.sql`
- Test: `supabase/tests/database/consent_preferences.test.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `public.set_consent_preference(p_type text, p_granted boolean, p_source text) returns void`, and tables `public.consent_preferences` / `public.consent_preference_events`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/consent_preferences.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_table('public', 'consent_preferences', 'preferences exist');
select has_table('public', 'consent_preference_events', 'preference history exists');

insert into auth.users (id, email, created_at) values
  ('e0000000-0000-4000-8000-000000000001', 'cata@test.local', now()),
  ('e0000000-0000-4000-8000-000000000002', 'dani@test.local', now());

set local role authenticated;
set local request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

-- absence is the resting state
select results_eq(
  $$select count(*) from public.consent_preferences$$,
  array[0::bigint],
  'no row exists until someone opts in, so nothing is granted by default'
);

select lives_ok(
  $$select public.set_consent_preference('marketing_email', true, 'registro')$$,
  'a person can grant marketing consent'
);

select results_eq(
  $$select granted from public.consent_preferences where consent_type = 'marketing_email'$$,
  array[true],
  'the grant is recorded'
);

select lives_ok(
  $$select public.set_consent_preference('marketing_email', false, 'cuenta')$$,
  'a person can withdraw it again'
);

select results_eq(
  $$select granted from public.consent_preferences where consent_type = 'marketing_email'$$,
  array[false],
  'withdrawal overwrites the current state'
);

select results_eq(
  $$select count(*) from public.consent_preference_events where consent_type = 'marketing_email'$$,
  array[2::bigint],
  'both the grant and the withdrawal are kept as history'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select results_eq(
  $$select count(*) from public.consent_preferences$$,
  array[0::bigint],
  'another person sees none of it'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$select public.set_consent_preference('algo_inventado', true, 'registro')$$,
  '22023', null,
  'an unknown consent type is refused'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.consent_preferences" does not exist`.

- [ ] **Step 3: Write the migration**

```bash
npx supabase migration new add_consent_preferences
```

```sql
-- Optional consent, kept apart from acceptance evidence because it has the
-- opposite mutability rule: it must be withdrawable at any time. The absence of
-- a row means "not granted", which makes "defaults unchecked" a property of the
-- schema rather than a checkbox attribute somebody can forget.
--
-- Nothing in the registration, shop-creation or purchase path may read these
-- tables. LFPC art. 18 BIS forbids conditioning service on marketing consent.

create table public.consent_preferences (
  user_id uuid not null references auth.users (id) on delete restrict,
  consent_type text not null check (consent_type in ('marketing_email', 'data_sharing')),
  granted boolean not null,
  changed_at timestamptz not null default now(),
  source text not null check (char_length(btrim(source)) between 2 and 60),
  primary key (user_id, consent_type)
);

create table public.consent_preference_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete restrict,
  consent_type text not null check (consent_type in ('marketing_email', 'data_sharing')),
  granted boolean not null,
  changed_at timestamptz not null default now(),
  source text not null
);

create index consent_preference_events_user_idx
  on public.consent_preference_events (user_id, consent_type, changed_at desc);

revoke all on table public.consent_preferences, public.consent_preference_events
  from public, anon, authenticated;
grant select on table public.consent_preferences to authenticated;
grant select on table public.consent_preference_events to authenticated;

alter table public.consent_preferences enable row level security;
alter table public.consent_preference_events enable row level security;

create policy own_preferences_are_readable on public.consent_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy own_preference_events_are_readable on public.consent_preference_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- A withdrawal is evidence too, so the history table never loses a row.
create function private.guard_consent_preference_events()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '42501',
    message = 'El historial de consentimiento no se modifica ni se elimina.';
end;
$$;

revoke execute on function private.guard_consent_preference_events()
  from public, anon, authenticated;

create trigger guard_consent_preference_events
  before update or delete on public.consent_preference_events
  for each row execute function private.guard_consent_preference_events();

create function public.set_consent_preference(
  p_type text,
  p_granted boolean,
  p_source text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if p_type not in ('marketing_email', 'data_sharing') then
    raise exception using errcode = '22023', message = 'Tipo de consentimiento desconocido.';
  end if;

  if p_granted is null then
    raise exception using errcode = '22023', message = 'Indica si autorizas o no.';
  end if;

  insert into public.consent_preferences (user_id, consent_type, granted, source)
  values (v_user, p_type, p_granted, p_source)
  on conflict (user_id, consent_type) do update
    set granted = excluded.granted,
        changed_at = now(),
        source = excluded.source;

  insert into public.consent_preference_events (user_id, consent_type, granted, source)
  values (v_user, p_type, p_granted, p_source);
end;
$$;

revoke all on function public.set_consent_preference(text, boolean, text) from public, anon;
grant execute on function public.set_consent_preference(text, boolean, text) to authenticated;

-- Rollback:
-- drop function public.set_consent_preference(text, boolean, text);
-- drop trigger guard_consent_preference_events on public.consent_preference_events;
-- drop function private.guard_consent_preference_events();
-- drop table public.consent_preference_events;
-- drop table public.consent_preferences;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker exec -i "$C" psql -U postgres -d postgres < supabase/migrations/<generated>_add_consent_preferences.sql
npx supabase test db
```

Expected: all files pass, `consent_preferences.test.sql` at 9/9.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/database/consent_preferences.test.sql
git commit -m "feat(consent): add revocable optional consent preferences

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Age attestation, with no date of birth

**Files:**
- Create: `supabase/migrations/<generated>_add_age_attestations.sql`
- Test: `supabase/tests/database/age_attestations.test.sql`

**Interfaces:**
- Consumes: `public.legal_document_versions`, `public.required_acceptance_documents()`
- Produces: `public.record_age_attestation(p_surface text) returns void`

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/age_attestations.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

select has_table('public', 'age_attestations', 'age attestations exist');

-- LFPDPPP art. 12 minimisation: the system must not be able to store one.
select hasnt_column('public', 'age_attestations', 'birth_date',
  'no birth date column exists');
select hasnt_column('public', 'age_attestations', 'date_of_birth',
  'no date of birth column exists under another name');

insert into auth.users (id, email, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'admin4@test.local', now()),
  ('f0000000-0000-4000-8000-000000000002', 'eva@test.local', now());

insert into private.admin_users (user_id, granted_by)
values ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001');

set local role authenticated;
set local request.jwt.claims = '{"sub": "f0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select public.create_legal_draft('platform_terms', 'Términos', '{"sections": [{"id": "objeto", "heading": "Objeto", "paragraphs": ["Texto."]}]}'::jsonb, 'primera', true);
select public.approve_legal_version(
  (select id from public.legal_document_versions where document_type = 'platform_terms' order by version desc limit 1),
  'Lic. Prueba', now());
select public.publish_legal_version(
  (select id from public.legal_document_versions where document_type = 'platform_terms' order by version desc limit 1),
  '{"entityName":"Ejemplo SA","rfc":"EJE010101AB1","address":"Calle 1","email":"a@b.mx","phone":"+525512345678","attentionHours":"L-V 9-18","privacyContact":"d@b.mx"}'::jsonb);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "f0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select lives_ok(
  $$select public.record_age_attestation('registro')$$,
  'a person can declare they are of age'
);

select results_eq(
  $$select count(*) from public.age_attestations$$,
  array[1::bigint],
  'the declaration is recorded once'
);

select lives_ok(
  $$select public.record_age_attestation('checkout')$$,
  'declaring again is harmless and does not duplicate'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx supabase test db
```

Expected: FAIL — `relation "public.age_attestations" does not exist`.

- [ ] **Step 3: Write the migration**

```bash
npx supabase migration new add_age_attestations
```

```sql
-- A self-declaration that the person is of age (Código Civil Federal art. 646
-- puts majority at eighteen). Deliberately NOT a date of birth: LFPDPPP art. 12
-- requires the treatment be the minimum necessary, and a boolean declaration is
-- the minimum that serves the purpose. There is no column here that could hold
-- one, and the test asserts that.

create table public.age_attestations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  attested_at timestamptz not null default now(),
  surface text not null check (char_length(btrim(surface)) between 2 and 40),
  terms_version_id uuid not null references public.legal_document_versions (id) on delete restrict
);

revoke all on table public.age_attestations from public, anon, authenticated;
grant select on table public.age_attestations to authenticated;

alter table public.age_attestations enable row level security;

create policy own_attestation_is_readable on public.age_attestations
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Ties the declaration to the terms version that stated the age rule, so what
-- the person was told is recoverable later.
create function public.record_age_attestation(p_surface text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_terms uuid;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  select id into v_terms
  from public.legal_document_versions
  where document_type = 'platform_terms' and status = 'published' and effective_at <= now()
  order by effective_at desc
  limit 1;

  if v_terms is null then
    raise exception using errcode = '22023',
      message = 'No hay términos publicados que expliquen la restricción de edad.';
  end if;

  insert into public.age_attestations (user_id, surface, terms_version_id)
  values (v_user, p_surface, v_terms)
  on conflict (user_id) do nothing;
end;
$$;

revoke all on function public.record_age_attestation(text) from public, anon;
grant execute on function public.record_age_attestation(text) to authenticated;

-- Rollback:
-- drop function public.record_age_attestation(text);
-- drop table public.age_attestations;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
docker exec -i "$C" psql -U postgres -d postgres < supabase/migrations/<generated>_add_age_attestations.sql
npx supabase test db
```

Expected: all files pass, `age_attestations.test.sql` at 6/6.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/database/age_attestations.test.sql
git commit -m "feat(consent): record an age declaration without a birth date

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Types and the read layer

**Files:**
- Modify: `lib/database.types.ts`
- Create: `lib/queries/consent.server.ts`, `lib/queries/consent.server.test.ts`

**Interfaces:**
- Consumes: the three tables and five functions from Tasks 3–6
- Produces:
  - `type RequiredDocument = { documentType: LegalDocumentType; versionId: string; version: number; title: string; publicPath: string | null }` — **exported from `lib/legal/document-types.ts`, not from the server module** (see Step 4)
  - `getRequiredAcceptanceDocuments(): Promise<RequiredDocument[]>`
  - `getPendingAcceptances(userId: string): Promise<LegalDocumentType[]>`
  - `getConsentPreferences(): Promise<Record<"marketing_email" | "data_sharing", boolean>>`

- [ ] **Step 1: Add the database types by hand**

Do **not** run `supabase gen types` over `lib/database.types.ts`. Generate into
`/tmp/generated-types.ts` to check your entries against the real schema, then
edit the tracked file in its existing compressed style. Add to `Tables`, in
alphabetical position:

```ts
      age_attestations: {
        Row: { user_id: string; attested_at: string; surface: string; terms_version_id: string };
        Insert: { user_id: string; attested_at?: string; surface: string; terms_version_id: string };
        Update: { user_id?: string; attested_at?: string; surface?: string; terms_version_id?: string };
        Relationships: [];
      };
      consent_preferences: {
        Row: { user_id: string; consent_type: ConsentType; granted: boolean; changed_at: string; source: string };
        Insert: { user_id: string; consent_type: ConsentType; granted: boolean; changed_at?: string; source: string };
        Update: { user_id?: string; consent_type?: ConsentType; granted?: boolean; changed_at?: string; source?: string };
        Relationships: [];
      };
      consent_preference_events: {
        Row: { id: number; user_id: string; consent_type: ConsentType; granted: boolean; changed_at: string; source: string };
        Insert: { id?: never; user_id: string; consent_type: ConsentType; granted: boolean; changed_at?: string; source: string };
        Update: { id?: never; user_id?: string; consent_type?: ConsentType; granted?: boolean; changed_at?: string; source?: string };
        Relationships: [];
      };
      legal_acceptances: {
        Row: { id: string; user_id: string; document_type: string; document_version_id: string; content_hash: string; accepted_at: string; surface: AcceptanceSurface; action: string; order_id: number | null; shop_id: number | null };
        Insert: { id?: string; user_id: string; document_type: string; document_version_id: string; content_hash: string; accepted_at?: string; surface: AcceptanceSurface; action: string; order_id?: number | null; shop_id?: number | null };
        Update: { id?: string; user_id?: string; document_type?: string; document_version_id?: string; content_hash?: string; accepted_at?: string; surface?: AcceptanceSurface; action?: string; order_id?: number | null; shop_id?: number | null };
        Relationships: [];
      };
```

Add beside `LegalDocumentStatus` near the top:

```ts
export type ConsentType = "marketing_email" | "data_sharing";
export type AcceptanceSurface = "registro" | "checkout" | "alta_tienda" | "panel";
```

Add to `Functions`, in alphabetical position:

```ts
      approve_legal_version: { Args: { p_version_id: string; p_approved_by: string; p_effective_at: string }; Returns: Database["public"]["Tables"]["legal_document_versions"]["Row"] };
      create_legal_draft: { Args: { p_type: string; p_title: string; p_body: Json; p_change_summary: string; p_is_material: boolean }; Returns: Database["public"]["Tables"]["legal_document_versions"]["Row"] };
      pending_acceptances: { Args: { p_user: string }; Returns: { document_type: string; version_id: string }[] };
      record_acceptances: { Args: { p_types: string[]; p_surface: string; p_action: string; p_order_id?: number | null; p_shop_id?: number | null }; Returns: number };
      record_age_attestation: { Args: { p_surface: string }; Returns: undefined };
      required_acceptance_documents: { Args: Record<never, never>; Returns: { document_type: string; version_id: string; version: number; title: string; public_path: string | null }[] };
      set_consent_preference: { Args: { p_type: string; p_granted: boolean; p_source: string }; Returns: undefined };
```

Add to the alias block at the end:

```ts
export type LegalAcceptance = Database["public"]["Tables"]["legal_acceptances"]["Row"];
export type ConsentPreference = Database["public"]["Tables"]["consent_preferences"]["Row"];
```

Run `npm run typecheck` — clean.

- [ ] **Step 2: Write the failing test**

Create `lib/queries/consent.server.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc, from }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));

afterEach(() => {
  rpc.mockReset();
  from.mockReset();
});

describe("getRequiredAcceptanceDocuments", () => {
  it("returns an empty list when nothing is published, without throwing", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const { getRequiredAcceptanceDocuments } = await import("@/lib/queries/consent.server");

    await expect(getRequiredAcceptanceDocuments()).resolves.toEqual([]);
  });

  it("returns an empty list when the query errors, so a surface degrades rather than breaks", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { getRequiredAcceptanceDocuments } = await import("@/lib/queries/consent.server");

    await expect(getRequiredAcceptanceDocuments()).resolves.toEqual([]);
  });

  it("maps published rows onto the camelCase shape", async () => {
    rpc.mockResolvedValue({
      data: [
        { document_type: "platform_terms", version_id: "v1", version: 2, title: "Términos", public_path: "/terminos" },
        { document_type: "buyer_terms", version_id: "v2", version: 1, title: "Términos de compra", public_path: null },
      ],
      error: null,
    });
    const { getRequiredAcceptanceDocuments } = await import("@/lib/queries/consent.server");

    const docs = await getRequiredAcceptanceDocuments();

    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ documentType: "platform_terms", versionId: "v1", publicPath: "/terminos" });
    expect(docs[1].publicPath).toBeNull();
  });
});

describe("getPendingAcceptances", () => {
  it("returns the document types still owed", async () => {
    rpc.mockResolvedValue({
      data: [{ document_type: "platform_terms", version_id: "v9" }],
      error: null,
    });
    const { getPendingAcceptances } = await import("@/lib/queries/consent.server");

    await expect(getPendingAcceptances("user-1")).resolves.toEqual(["platform_terms"]);
  });

  it("returns nothing on error rather than blocking the person", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { getPendingAcceptances } = await import("@/lib/queries/consent.server");

    await expect(getPendingAcceptances("user-1")).resolves.toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
npx vitest run lib/queries/consent.server.test.ts
```

Expected: FAIL — cannot resolve `@/lib/queries/consent.server`.

- [ ] **Step 4: Write the read layer**

**First, add the shared type to a client-safe module.** `RequiredDocument` is a
prop type for `AcceptanceCheckbox` and `ShopForm`, both of which are client
components. It must NOT live in `consent.server.ts`, because that file opens
with `import "server-only"`: a type-only import is erased and would work, but
the day someone drops the `type` keyword the client build fails with a
confusing server-only error. Put it where the rest of the client-safe legal
types already live.

Append to `lib/legal/document-types.ts`:

```ts
/** A required document that actually has a published version to accept. */
export type RequiredDocument = {
  documentType: LegalDocumentType;
  versionId: string;
  version: number;
  title: string;
  publicPath: string | null;
};
```

Then create `lib/queries/consent.server.ts`:

```ts
import "server-only";

import type { ConsentType } from "@/lib/database.types";
import type { LegalDocumentType, RequiredDocument } from "@/lib/legal/document-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type { RequiredDocument };

/**
 * The required documents that actually have a published version.
 *
 * An empty array is the correct answer while counsel has approved nothing, and
 * every caller must treat it as "there is nothing to accept" rather than as an
 * error — asking someone to accept a document that does not exist would be the
 * dishonest failure mode.
 */
export async function getRequiredAcceptanceDocuments(): Promise<RequiredDocument[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("required_acceptance_documents");

  if (error) {
    console.error("[consent] required_acceptance_documents failed:", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];

  return data.flatMap((row) => {
    const record = row as Record<string, unknown>;
    if (typeof record.document_type !== "string" || typeof record.version_id !== "string") return [];

    return [{
      documentType: record.document_type as LegalDocumentType,
      versionId: record.version_id,
      version: Number(record.version),
      title: String(record.title ?? ""),
      publicPath: typeof record.public_path === "string" ? record.public_path : null,
    }];
  });
}

/** Types this person still owes an acceptance for, after a material change. */
export async function getPendingAcceptances(userId: string): Promise<LegalDocumentType[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("pending_acceptances", { p_user: userId });

  if (error) {
    console.error("[consent] pending_acceptances failed:", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];

  return data.flatMap((row) => {
    const type = (row as Record<string, unknown>).document_type;
    return typeof type === "string" ? [type as LegalDocumentType] : [];
  });
}

/** Current optional consent. A missing row is `false` — never granted by default. */
export async function getConsentPreferences(): Promise<Record<ConsentType, boolean>> {
  const defaults: Record<ConsentType, boolean> = {
    marketing_email: false,
    data_sharing: false,
  };

  if (!isSupabaseConfigured()) return defaults;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("consent_preferences")
    .select("consent_type, granted");

  if (error || !Array.isArray(data)) return defaults;

  for (const row of data) {
    const record = row as { consent_type?: unknown; granted?: unknown };
    if (typeof record.consent_type === "string" && typeof record.granted === "boolean") {
      if (record.consent_type in defaults) {
        defaults[record.consent_type as ConsentType] = record.granted;
      }
    }
  }

  return defaults;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run lib/queries/consent.server.test.ts
npm run typecheck
```

Expected: PASS, 5 tests; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/database.types.ts lib/queries/consent.server.ts lib/queries/consent.server.test.ts
git commit -m "feat(consent): read required documents and consent state

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Acceptance at registration

This is where spec tests 6, 7 and 8 land: a required acceptance blocks
registration when absent, optional marketing consent defaults unchecked, and
refusing marketing does not block anything.

**Files:**
- Create: `components/consent/acceptance-checkbox.tsx`, `components/consent/acceptance-checkbox.test.tsx`, `components/consent/marketing-preference.tsx`, `components/consent/marketing-preference.test.tsx`, `lib/validation/consent.ts`, `lib/validation/consent.test.ts`
- Modify: `components/auth/auth-form.tsx`, `components/auth/auth-form.test.tsx`, `lib/actions/auth.ts`, `app/(auth)/registro/page.tsx`

**Interfaces:**
- Consumes: `getRequiredAcceptanceDocuments`, `record_acceptances`, `record_age_attestation`, `set_consent_preference`
- Produces: `<AcceptanceCheckbox documents={RequiredDocument[]} error={string | undefined} />`, `<MarketingPreference defaultGranted={boolean} />`, `acceptanceSchema`

- [ ] **Step 1: Write the failing component tests**

Create `components/consent/acceptance-checkbox.test.tsx`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AcceptanceCheckbox } from "@/components/consent/acceptance-checkbox";

afterEach(cleanup);

const documents = [
  { documentType: "platform_terms" as const, versionId: "v1", version: 1, title: "Términos y condiciones", publicPath: "/terminos" },
  { documentType: "privacy_notice" as const, versionId: "v2", version: 1, title: "Aviso de privacidad", publicPath: "/privacidad" },
  { documentType: "buyer_terms" as const, versionId: "v3", version: 1, title: "Términos de compra", publicPath: null },
];

describe("AcceptanceCheckbox", () => {
  it("renders nothing when no document is published, because there is nothing to accept", () => {
    const { container } = render(<AcceptanceCheckbox documents={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one required checkbox, not one per document", () => {
    render(<AcceptanceCheckbox documents={documents} />);

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toBeRequired();
  });

  it("starts unchecked", () => {
    render(<AcceptanceCheckbox documents={documents} />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("links each document separately rather than bundling them into one vague phrase", () => {
    render(<AcceptanceCheckbox documents={documents} />);

    const group = screen.getByRole("group", { name: /documentos que aceptas/i });
    expect(within(group).getByRole("link", { name: "Términos y condiciones" })).toHaveAttribute("href", "/terminos");
    expect(within(group).getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute("href", "/privacidad");
  });

  it("names a document with no public route without inventing a link for it", () => {
    render(<AcceptanceCheckbox documents={documents} />);

    const group = screen.getByRole("group", { name: /documentos que aceptas/i });
    expect(within(group).getByText("Términos de compra")).toBeInTheDocument();
    expect(within(group).queryByRole("link", { name: "Términos de compra" })).toBeNull();
  });

  it("submits the document types so the server never takes a version id from the client", () => {
    render(<AcceptanceCheckbox documents={documents} />);

    const hidden = document.querySelector('input[name="accepted_types"]');
    expect(hidden).toHaveValue("platform_terms,privacy_notice,buyer_terms");
    expect(document.querySelector('input[name="accepted_version_ids"]')).toBeNull();
  });

  it("announces its error", () => {
    render(<AcceptanceCheckbox documents={documents} error="Debes aceptar los documentos para continuar." />);

    expect(screen.getByRole("alert")).toHaveTextContent(/debes aceptar/i);
  });
});
```

Create `components/consent/marketing-preference.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketingPreference } from "@/components/consent/marketing-preference";

afterEach(cleanup);

describe("MarketingPreference", () => {
  it("is unchecked by default", () => {
    render(<MarketingPreference />);

    expect(screen.getByRole("checkbox", { name: /avisos/i })).not.toBeChecked();
  });

  it("is not required, so refusing it cannot block anything", () => {
    render(<MarketingPreference />);

    expect(screen.getByRole("checkbox", { name: /avisos/i })).not.toBeRequired();
  });

  it("says plainly that it is optional", () => {
    render(<MarketingPreference />);

    expect(screen.getByText(/opcional/i)).toBeInTheDocument();
  });

  it("reflects an existing grant when the person already opted in", () => {
    render(<MarketingPreference defaultGranted />);

    expect(screen.getByRole("checkbox", { name: /avisos/i })).toBeChecked();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run components/consent
```

Expected: FAIL — neither component resolves.

- [ ] **Step 3: Write the validation schema**

Create `lib/validation/consent.ts`:

```ts
import { z } from "zod";

/**
 * The form sends document TYPES, never version ids or hashes — the database
 * resolves the published version itself, so there is no parameter a crafted
 * version could arrive in.
 */
export const acceptanceSchema = z.object({
  accepted_types: z
    .string()
    .transform((value) => value.split(",").map((part) => part.trim()).filter(Boolean)),
  accepts: z.literal("on", {
    error: "Debes aceptar los documentos para continuar.",
  }),
  is_adult: z.literal("on", {
    error: "Debes confirmar que eres mayor de edad para continuar.",
  }),
});

export const marketingSchema = z.object({
  marketing_email: z.union([z.literal("on"), z.undefined()]).transform((v) => v === "on"),
});
```

- [ ] **Step 4: Write the components**

Create `components/consent/acceptance-checkbox.tsx`:

```tsx
import Link from "next/link";

import type { RequiredDocument } from "@/lib/legal/document-types";

/**
 * One required checkbox that names every document separately, each linked where
 * it has a public route. Deliberately not one checkbox per document — and
 * deliberately not a single vague sentence either: a person has to be able to
 * see what they are agreeing to and open it.
 *
 * Renders nothing when nothing is published. There is no honest way to ask
 * someone to accept a document that does not exist yet.
 */
export function AcceptanceCheckbox({
  documents,
  error,
}: {
  documents: RequiredDocument[];
  error?: string;
}) {
  if (documents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div
        aria-label="Documentos que aceptas"
        className="rounded-2xl border border-line bg-background p-4"
        role="group"
      >
        <ul className="space-y-1.5 text-sm leading-6">
          {documents.map((document) => (
            <li key={document.documentType}>
              {document.publicPath ? (
                <Link
                  className="font-semibold text-brand underline decoration-accent decoration-4 underline-offset-4"
                  href={document.publicPath}
                >
                  {document.title}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{document.title}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <input
        name="accepted_types"
        type="hidden"
        value={documents.map((document) => document.documentType).join(",")}
      />

      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          aria-describedby={error ? "accepts-error" : undefined}
          aria-invalid={Boolean(error)}
          className="mt-1 size-5 shrink-0 rounded border-line"
          name="accepts"
          required
          type="checkbox"
        />
        <span>He leído y acepto los documentos anteriores.</span>
      </label>

      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          className="mt-1 size-5 shrink-0 rounded border-line"
          name="is_adult"
          required
          type="checkbox"
        />
        <span>Confirmo que tengo 18 años o más.</span>
      </label>

      {error ? (
        <p className="text-sm font-medium text-sale" id="accepts-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

Create `components/consent/marketing-preference.tsx`:

```tsx
/**
 * Optional and separate from the required acceptance, because bundling them
 * would make the optional one a condition of service. LFPC art. 18 BIS.
 * Unchecked unless the person previously opted in.
 */
export function MarketingPreference({ defaultGranted = false }: { defaultGranted?: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm leading-6">
      <input
        className="mt-1 size-5 shrink-0 rounded border-line"
        defaultChecked={defaultGranted}
        name="marketing_email"
        type="checkbox"
      />
      <span>
        Quiero recibir avisos por correo sobre novedades de la plaza.{" "}
        <span className="text-muted">(Opcional; puedes retirarlo cuando quieras.)</span>
      </span>
    </label>
  );
}
```

- [ ] **Step 5: Run the component tests to verify they pass**

```bash
npx vitest run components/consent
```

Expected: PASS, 11 tests.

- [ ] **Step 6: Wire the registration action**

In `lib/actions/auth.ts`, inside `signUp`, after the existing credential parse
and **before** calling `supabase.auth.signUp`, parse the acceptance fields only
when the form carried them:

```ts
  const acceptedTypes = String(formData.get("accepted_types") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // The checkbox is only rendered when something is published, so its absence
  // is a legitimate state rather than a tampered form.
  if (acceptedTypes.length > 0) {
    const accepted = acceptanceSchema.safeParse({
      accepted_types: formData.get("accepted_types"),
      accepts: formData.get("accepts"),
      is_adult: formData.get("is_adult"),
    });

    if (!accepted.success) {
      return {
        status: "error",
        message: "Debes aceptar los documentos y confirmar tu edad para continuar.",
        values: { email: String(formData.get("email") ?? "") },
      };
    }
  }
```

Then, after a successful `signUp` that returns a session, record the evidence:

```ts
  if (acceptedTypes.length > 0) {
    const { error: acceptanceError } = await supabase.rpc("record_acceptances", {
      p_types: acceptedTypes,
      p_surface: "registro",
      p_action: "Crear cuenta",
    });

    if (acceptanceError) {
      // The account exists; the evidence does not. pending_acceptances will
      // catch this person on their next authenticated page load rather than
      // stranding them mid-signup.
      console.error("[consent] record_acceptances failed at signup:", acceptanceError.message);
    } else {
      await supabase.rpc("record_age_attestation", { p_surface: "registro" });
    }
  }

  // Optional consent is written separately and never blocks anything.
  if (formData.get("marketing_email") === "on") {
    await supabase.rpc("set_consent_preference", {
      p_type: "marketing_email",
      p_granted: true,
      p_source: "registro",
    });
  }
```

Import `acceptanceSchema` from `@/lib/validation/consent`.

- [ ] **Step 7: Render them on the registration page**

In `app/(auth)/registro/page.tsx`, fetch the documents server-side and pass them
down:

```tsx
import { getRequiredAcceptanceDocuments } from "@/lib/queries/consent.server";
```

```tsx
  const requiredDocuments = await getRequiredAcceptanceDocuments();
```

Pass `requiredDocuments` into `<AuthForm />` as a new prop, and in
`components/auth/auth-form.tsx` render `<AcceptanceCheckbox documents={requiredDocuments} />`
and `<MarketingPreference />` above the submit button, for `mode="signup"` only.
Sign-in renders neither.

- [ ] **Step 8: Add the registration-level tests**

Add to `components/auth/auth-form.test.tsx`:

```tsx
  it("asks for no acceptance while nothing is published", () => {
    render(<AuthForm mode="signup" requiredDocuments={[]} />);

    expect(screen.queryByRole("checkbox", { name: /acepto/i })).toBeNull();
  });

  it("requires acceptance once a document is published", () => {
    render(
      <AuthForm
        mode="signup"
        requiredDocuments={[
          { documentType: "platform_terms", versionId: "v1", version: 1, title: "Términos y condiciones", publicPath: "/terminos" },
        ]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /acepto los documentos/i })).toBeRequired();
  });

  it("keeps marketing consent optional and unchecked", () => {
    render(<AuthForm mode="signup" requiredDocuments={[]} />);

    const marketing = screen.getByRole("checkbox", { name: /avisos/i });
    expect(marketing).not.toBeChecked();
    expect(marketing).not.toBeRequired();
  });

  it("shows no acceptance or marketing control when signing in", () => {
    render(<AuthForm mode="signin" requiredDocuments={[]} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
  });
```

- [ ] **Step 9: Verify**

```bash
npx vitest run components/consent components/auth lib/validation/consent.test.ts
npm test
npm run typecheck
npm run lint
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add components/consent lib/validation/consent.ts lib/validation/consent.test.ts components/auth lib/actions/auth.ts "app/(auth)/registro/page.tsx"
git commit -m "feat(consent): record acceptance and age at registration

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Seller terms at shop creation

**Files:**
- Modify: `components/shops/shop-form.tsx`, `components/shops/shop-form.test.tsx`, `lib/actions/shops.ts`, `app/panel/tiendas/nueva/page.tsx`

**Interfaces:**
- Consumes: `getRequiredAcceptanceDocuments`, `<AcceptanceCheckbox>`, `record_acceptances`
- Produces: nothing new

- [ ] **Step 1: Write the failing test**

Add to `components/shops/shop-form.test.tsx`:

```tsx
  it("requires the seller terms once they are published", () => {
    render(
      <ShopForm
        action={noop}
        requiredDocuments={[
          { documentType: "seller_terms", versionId: "v1", version: 1, title: "Términos para vendedores", publicPath: "/terminos-vendedores" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Términos para vendedores" }))
      .toHaveAttribute("href", "/terminos-vendedores");
    expect(screen.getByRole("checkbox", { name: /acepto los documentos/i })).toBeRequired();
  });

  it("asks for nothing while the seller terms are unpublished", () => {
    render(<ShopForm action={noop} requiredDocuments={[]} />);

    expect(screen.queryByRole("checkbox", { name: /acepto/i })).toBeNull();
  });
```

Define `noop` alongside the file's existing fixtures if it does not already have
one: `const noop = async () => ({ status: "idle" as const });`

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run components/shops/shop-form.test.tsx
```

Expected: FAIL — `ShopForm` takes no `requiredDocuments` prop.

- [ ] **Step 3: Wire it**

In `app/panel/tiendas/nueva/page.tsx`, filter the required documents to the
seller-facing ones and pass them down:

```tsx
const requiredDocuments = (await getRequiredAcceptanceDocuments()).filter(
  (document) => document.documentType === "seller_terms" || document.documentType === "platform_terms",
);
```

In `components/shops/shop-form.tsx`, accept `requiredDocuments: RequiredDocument[]`
and render `<AcceptanceCheckbox documents={requiredDocuments} />` above the
submit button. In `lib/actions/shops.ts`, after the shop row is created
successfully, record the acceptance against the new shop:

```ts
  const acceptedTypes = String(formData.get("accepted_types") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (acceptedTypes.length > 0) {
    const { error: acceptanceError } = await supabase.rpc("record_acceptances", {
      p_types: acceptedTypes,
      p_surface: "alta_tienda",
      p_action: "Crear tienda",
      p_shop_id: created.id,
    });

    if (acceptanceError) {
      console.error("[consent] record_acceptances failed at shop creation:", acceptanceError.message);
    }
  }
```

Replace `created.id` with whatever the file already names the inserted row.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run components/shops
npm test && npm run typecheck && npm run lint
git add components/shops lib/actions/shops.ts app/panel/tiendas/nueva/page.tsx
git commit -m "feat(consent): record seller terms acceptance at shop creation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Where a person reviews and withdraws consent

Spec test 9 — consent withdrawal is recorded — lands here.

**Files:**
- Create: `app/cuenta/privacidad/page.tsx`, `components/consent/consent-settings.tsx`, `components/consent/consent-settings.test.tsx`, `lib/actions/consent.ts`
- Modify: `components/layout/site-footer.tsx`, `components/layout/site-footer.test.tsx`, `app/robots.ts`

**Interfaces:**
- Consumes: `getConsentPreferences`, `set_consent_preference`
- Produces: `updateMarketingPreference(state, formData)` server action

- [ ] **Step 1: Write the failing test**

Create `components/consent/consent-settings.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConsentSettings } from "@/components/consent/consent-settings";

afterEach(cleanup);

const noop = async () => ({ status: "idle" as const });

describe("ConsentSettings", () => {
  it("shows marketing consent as not granted when nothing was ever chosen", () => {
    render(<ConsentSettings action={noop} preferences={{ marketing_email: false, data_sharing: false }} />);

    expect(screen.getByRole("checkbox", { name: /avisos/i })).not.toBeChecked();
  });

  it("shows it as granted once the person opted in", () => {
    render(<ConsentSettings action={noop} preferences={{ marketing_email: true, data_sharing: false }} />);

    expect(screen.getByRole("checkbox", { name: /avisos/i })).toBeChecked();
  });

  it("offers a way to save the change", () => {
    render(<ConsentSettings action={noop} preferences={{ marketing_email: true, data_sharing: false }} />);

    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
  });

  it("states that withdrawing does not affect purchases", () => {
    render(<ConsentSettings action={noop} preferences={{ marketing_email: false, data_sharing: false }} />);

    expect(screen.getByText(/no afecta tus compras/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run components/consent/consent-settings.test.tsx
```

Expected: FAIL — component does not resolve.

- [ ] **Step 3: Write the action, the component and the page**

Create `lib/actions/consent.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateMarketingPreference(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente." };

  const { error } = await supabase.rpc("set_consent_preference", {
    p_type: "marketing_email",
    p_granted: formData.get("marketing_email") === "on",
    p_source: "cuenta",
  });

  if (error) return { status: "error", message: "No pudimos guardar tu preferencia." };

  revalidatePath("/cuenta/privacidad");
  return { status: "success", message: "Preferencia guardada." };
}
```

Create `components/consent/consent-settings.tsx` as a client component that
renders the `MarketingPreference` checkbox inside a form bound to that action,
with a submit button labelled "Guardar preferencias", a `role="status"` region
for the action message, and this sentence beneath: *"Retirar este permiso no
afecta tus compras ni tus pedidos."*

Create `app/cuenta/privacidad/page.tsx` as a server component that reads
`getConsentPreferences()`, redirects to `/ingresar` when there is no session
(follow the pattern in `app/panel/cuenta/page.tsx`), and renders
`<ConsentSettings>`.

Add `/cuenta/` to `PRIVATE_PATHS` in `app/robots.ts` — it is behind a session
and has nothing to offer a crawler. Add a "Privacidad de tu cuenta" link to the
footer's legal nav, and extend `components/layout/site-footer.test.tsx` to
assert it.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run components/consent components/layout app/robots.test.ts
npm test && npm run typecheck && npm run lint
git add app/cuenta components/consent lib/actions/consent.ts components/layout app/robots.ts
git commit -m "feat(consent): let a person review and withdraw optional consent

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Re-acceptance after a material change

**Files:**
- Create: `components/consent/pending-acceptance-notice.tsx`, `components/consent/pending-acceptance-notice.test.tsx`
- Modify: `app/panel/layout.tsx`

**Interfaces:**
- Consumes: `getPendingAcceptances`, `getRequiredAcceptanceDocuments`, `record_acceptances`
- Produces: nothing new

- [ ] **Step 1: Write the failing test**

Create `components/consent/pending-acceptance-notice.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PendingAcceptanceNotice } from "@/components/consent/pending-acceptance-notice";

afterEach(cleanup);

const noop = async () => ({ status: "idle" as const });

const documents = [
  { documentType: "platform_terms" as const, versionId: "v2", version: 2, title: "Términos y condiciones", publicPath: "/terminos" },
];

describe("PendingAcceptanceNotice", () => {
  it("renders nothing when nothing is pending", () => {
    const { container } = render(<PendingAcceptanceNotice action={noop} documents={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names what changed and links it", () => {
    render(<PendingAcceptanceNotice action={noop} documents={documents} />);

    expect(screen.getByRole("link", { name: "Términos y condiciones" })).toHaveAttribute("href", "/terminos");
  });

  it("announces itself to a screen reader", () => {
    render(<PendingAcceptanceNotice action={noop} documents={documents} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not block the page — it asks, it does not trap", () => {
    render(<PendingAcceptanceNotice action={noop} documents={documents} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run components/consent/pending-acceptance-notice.test.tsx
```

Expected: FAIL — component does not resolve.

- [ ] **Step 3: Write the component and mount it**

Create `components/consent/pending-acceptance-notice.tsx`: a banner with
`role="status"`, listing each pending document (linked where it has a public
path), one required checkbox reusing the same "He leído y acepto los documentos
anteriores." wording, and a submit button reading "Aceptar y continuar". It must
not be a modal — a person who wants to read the document first has to be able to
leave the page.

In `app/panel/layout.tsx`, read the session, call `getPendingAcceptances` with
the session's own user id, intersect that with `getRequiredAcceptanceDocuments()`
to get titles and paths, and render the notice above `{children}`. Bind it to a
server action that calls `record_acceptances` with `p_surface: "panel"` and
`p_action: "Aceptar y continuar"`.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run components/consent
npm test && npm run typecheck && npm run lint
git add components/consent app/panel/layout.tsx
git commit -m "feat(consent): ask again after a material change

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Definition of done

- A required acceptance blocks registration when a document is published, and
  asks for nothing when none is (spec test 6).
- Optional marketing consent renders unchecked, is not required, and nothing in
  the registration, shop-creation or purchase path reads it (spec tests 7, 8).
- Withdrawal is recorded in `consent_preference_events` and the history cannot
  be edited or deleted (spec test 9).
- `record_acceptances` accepts no version id or hash from the client, and
  refuses a type with no published version (spec test 10).
- Acceptance evidence cannot be updated or deleted by anyone, including
  `service_role`.
- A person reads only their own acceptances and preferences; `anon` reads none.
- `age_attestations` has no column that could hold a date of birth.
- At most one published version per document type exists, enforced by index.
- No migration contains a forbidden claim, enforced by `tests/claims-audit.test.ts`.
- `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` and
  `npx supabase test db` all pass.

## Not in this plan

Seller compliance identity (plan 3), checkout disclosure and the transaction
receipt (plan 4), complaints and ARCO (plan 5). Drafting the Spanish content of
any legal document — counsel is not engaged, and the acceptance surfaces
deliberately render nothing until one is published.
