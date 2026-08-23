# Messaging System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Plaza Volcanes pre-sale conversations, split buyer and seller inboxes with unread counts and live delivery, and an audited administrator read path replacing today's silent one.

**Architecture:** Everything is built on the `public.conversations` and `public.messages` tables that already exist. New database objects are additive except for three deliberate changes: the administrator branch leaves two row-level security policies, `private.record_message_evidence` gains an order-only guard, and `public.start_pre_sale_conversation` is rewritten so an idempotent re-open does not consume rate-limit quota. The application layer follows the established pure-mapper plus server-fetch split from `lib/queries/orders.ts` and `lib/queries/orders.server.ts`.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, Supabase (`@supabase/ssr` 0.12.4, `@supabase/supabase-js` 2.112.3), Postgres with pgTAP and pg_cron, Zod 4, Tailwind 4, Vitest 4 with Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-23-messaging-system-design.md`

## Global Constraints

- **Read the Next.js guide before writing route or component code.** Per `AGENTS.md`, this Next.js has breaking changes from training data. Read the relevant file under `node_modules/next/dist/docs/` before authoring anything in `app/` or a client component.
- All database functions are `security definer` with `set search_path = ''`, and every identifier inside them is schema-qualified. This matches every existing migration.
- Helper functions live in `private` and are revoked from `public, anon, authenticated`. Only `public.*` functions are granted to `authenticated`.
- All user-facing copy is Spanish. Error messages raised from SQL are shown to users, so they are written as Spanish sentences.
- Migration files are named `supabase/migrations/YYYYMMDDHHMMSS_<snake_case>.sql` and end with a commented rollback, matching the house pattern.
- Message bodies are 1–2000 characters after trimming. Display names are 2–40 characters after trimming.
- Rate limits: 60 messages per user per hour; 10 new pre-sale conversations per user per rolling 24 hours.
- Pre-sale conversations idle for 180 days are purged. Order conversations are never automatically purged.
- The seller response clock covers `type = 'order'` conversations only.
- Realtime is an accelerator. Server-rendered history is always authoritative.
- Run `npm run lint && npm run typecheck && npm test` before every commit. Run `supabase test db supabase/tests/database` for tasks touching SQL.

---

### Task 1: Buyer display names in the database

**Files:**
- Create: `supabase/migrations/20260823090000_add_user_display_names.sql`
- Test: `supabase/tests/database/user_display_names.test.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `public.user_display_names(user_id uuid, display_name text, updated_at timestamptz)`; `private.display_label(p_user_id uuid, p_name text) returns text`; `public.set_display_name(p_display_name text) returns void`; `public.my_display_name() returns text`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/user_display_names.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_table('public', 'user_display_names', 'display name table exists');

insert into auth.users (id, email, created_at, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'named@test.local', now(), '{"display_name": "Ana Ruiz"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'blank@test.local', now(), '{"display_name": " "}'::jsonb),
  ('33333333-3333-4333-8333-333333333333', 'none@test.local', now(), '{}'::jsonb);

select results_eq(
  $$select display_name from public.user_display_names where user_id = '11111111-1111-4111-8111-111111111111'$$,
  array['Ana Ruiz'::text],
  'registration metadata becomes a display name'
);

select is_empty(
  $$select 1 from public.user_display_names where user_id = '22222222-2222-4222-8222-222222222222'$$,
  'unusable sign-up metadata stores no row instead of failing account creation'
);

select is(
  private.display_label('33333333-3333-4333-8333-333333333333', null),
  'Comprador #3333',
  'a person with no name gets a stable handle'
);

select is(
  private.display_label('11111111-1111-4111-8111-111111111111', 'Ana Ruiz'),
  'Ana Ruiz',
  'a person with a name gets their name'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}';

select throws_ok(
  $$select display_name from public.user_display_names$$,
  '42501',
  null,
  'display names are not readable through row level security'
);

select lives_ok(
  $$select public.set_display_name('Carlos Vega')$$,
  'a person may set their own display name'
);

select is(
  public.my_display_name(),
  'Carlos Vega',
  'a person reads back the name they set'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db supabase/tests/database/user_display_names.test.sql`
Expected: FAIL — `relation "public.user_display_names" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260823090000_add_user_display_names.sql`:

```sql
-- A seller talking to a buyer before any order exists has no name to address.
-- Order addresses carry a recipient, but a pre-sale conversation has no order,
-- so a name of its own is needed. It is deliberately not public: it is read
-- only inside a conversation both people are already part of.
create table public.user_display_names (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(btrim(display_name)) between 2 and 40),
  updated_at timestamptz not null default now()
);

-- No grant to authenticated. Names reach a browser only through the
-- conversation functions, which have already established participation.
revoke all on table public.user_display_names from public, anon, authenticated;
grant select, insert, update, delete on table public.user_display_names to service_role;

alter table public.user_display_names enable row level security;

-- Every read path needs the same fallback, so it lives in one place.
create function private.display_label(p_user_id uuid, p_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(p_name), ''),
    'Comprador #' || upper(left(replace(p_user_id::text, '-', ''), 4))
  )
$$;

revoke execute on function private.display_label(uuid, text) from public, anon, authenticated;

create function private.handle_new_user_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted text;
begin
  submitted := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));

  -- Sign-up metadata is client supplied: store it only when it satisfies the
  -- constraint, so a crafted payload cannot block account creation.
  if char_length(submitted) between 2 and 40 then
    insert into public.user_display_names (user_id, display_name)
    values (new.id, submitted)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function private.handle_new_user_display_name()
from public, anon, authenticated;

create trigger on_auth_user_created_display_name
  after insert on auth.users
  for each row
  execute function private.handle_new_user_display_name();

create function public.set_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if char_length(v_name) not between 2 and 40 then
    raise exception using errcode = '22023', message = 'Tu nombre debe tener entre 2 y 40 caracteres.';
  end if;

  insert into public.user_display_names (user_id, display_name)
  values (v_user, v_name)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = now();
end;
$$;

revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

create function public.my_display_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select display_name from public.user_display_names where user_id = auth.uid()
$$;

revoke all on function public.my_display_name() from public, anon;
grant execute on function public.my_display_name() to authenticated;

-- Existing accounts get no row on purpose. They read as the fallback handle
-- until the person sets a name from their account page, so nobody is nagged
-- and no backfill invents a name for them.

-- Rollback:
-- drop trigger on_auth_user_created_display_name on auth.users;
-- drop function private.handle_new_user_display_name();
-- drop function public.my_display_name();
-- drop function public.set_display_name(text);
-- drop function private.display_label(uuid, text);
-- drop table public.user_display_names;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && supabase test db supabase/tests/database/user_display_names.test.sql`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823090000_add_user_display_names.sql supabase/tests/database/user_display_names.test.sql
git commit -m "feat: give buyers a name a seller can address them by"
```

---

### Task 2: Collect the display name at registration and on the account page

**Files:**
- Modify: `lib/validation/auth.ts`
- Modify: `lib/actions/auth.ts`
- Modify: `components/auth/auth-form.tsx`
- Create: `components/account/display-name-form.tsx`
- Modify: `app/panel/cuenta/page.tsx`
- Test: `components/account/display-name-form.test.tsx`

**Interfaces:**
- Consumes: `public.set_display_name(text)`, `public.my_display_name()` from Task 1.
- Produces: `displayNameSchema` from `lib/validation/auth.ts`; `updateDisplayName(previousState, formData) => Promise<ActionState>` from `lib/actions/auth.ts`; `<DisplayNameForm action displayName />`.

- [ ] **Step 1: Write the failing test**

Create `components/account/display-name-form.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { DisplayNameForm } from "@/components/account/display-name-form";

test("shows the name a person already set", () => {
  render(<DisplayNameForm action={vi.fn()} displayName="Ana Ruiz" />);

  expect(screen.getByLabelText(/nombre/i)).toHaveValue("Ana Ruiz");
});

test("starts empty when a person has no name yet", () => {
  render(<DisplayNameForm action={vi.fn()} displayName={null} />);

  expect(screen.getByLabelText(/nombre/i)).toHaveValue("");
});

test("explains who will see the name", () => {
  render(<DisplayNameForm action={vi.fn()} displayName={null} />);

  expect(screen.getByText(/solo lo ven las tiendas/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/account/display-name-form.test.tsx`
Expected: FAIL — cannot resolve `@/components/account/display-name-form`.

- [ ] **Step 3: Write the implementation**

Read `components/account/phone-form.tsx` first and mirror its structure exactly, including its use of `useFormAction`.

Create `components/account/display-name-form.tsx`:

```tsx
"use client";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

export function DisplayNameForm({
  action,
  displayName,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  displayName: string | null;
}) {
  const [state, formAction, pending] = useFormAction(action);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm font-semibold" htmlFor="display-name">
        Tu nombre
      </label>
      <p className="text-sm text-muted">
        Solo lo ven las tiendas con las que conversas. No aparece en tu perfil ni en el catálogo.
      </p>
      <input
        className="w-full rounded-2xl border border-line bg-background px-4 py-3"
        defaultValue={state.values?.display_name ?? displayName ?? ""}
        id="display-name"
        maxLength={40}
        minLength={2}
        name="display_name"
        placeholder="Ana Ruiz"
        required
        type="text"
      />
      <button
        className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
        disabled={pending}
        type="submit"
      >
        {pending ? "Guardando…" : "Guardar nombre"}
      </button>
      {state.message ? (
        <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
```

Add to `lib/validation/auth.ts`:

```ts
export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Tu nombre debe tener entre 2 y 40 caracteres.")
  .max(40, "Tu nombre debe tener entre 2 y 40 caracteres.");
```

Extend `signUpSchema` in the same file:

```ts
export const signUpSchema = authSchema.extend({
  phone: mexicanMobileSchema,
  display_name: displayNameSchema,
});
```

In `lib/actions/auth.ts`, add `display_name` to the `signUpSchema.safeParse` input alongside the existing `phone` field, and pass it through the sign-up metadata so the Task 1 trigger picks it up:

```ts
options: {
  // ...existing options
  data: { phone, display_name: parsed.data.display_name },
},
```

Add the account-page action to the same file:

```ts
export async function updateDisplayName(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = displayNameSchema.safeParse(formData.get("display_name"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Nombre inválido.",
      values: formValues(formData),
    };
  }

  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_display_name", { p_display_name: parsed.data });
  if (error) {
    return { status: "error", message: "No pudimos guardar tu nombre.", values: formValues(formData) };
  }

  revalidatePath("/panel/cuenta");
  return { status: "success", message: "Nombre guardado." };
}
```

In `components/auth/auth-form.tsx`, add a `display_name` text input rendered only when `mode === "signup"`, placed above the phone field, labelled `Tu nombre`, with `minLength={2}`, `maxLength={40}` and `required`.

In `app/panel/cuenta/page.tsx`, fetch the name and render the form beneath the existing `PhoneForm`:

```tsx
const { data: displayName } = await supabase.rpc("my_display_name");
```

```tsx
<div className="mt-8 border-t border-line pt-8">
  <DisplayNameForm action={updateDisplayName} displayName={displayName ?? null} />
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/account/display-name-form.test.tsx && npm run typecheck`
Expected: PASS, 3 tests, and a clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/auth.ts lib/actions/auth.ts components/auth/auth-form.tsx components/account/display-name-form.tsx components/account/display-name-form.test.tsx app/panel/cuenta/page.tsx
git commit -m "feat: ask for a name at sign-up and let people change it later"
```

---

### Task 3: Read tracking and unread counts

**Files:**
- Create: `supabase/migrations/20260823091000_add_conversation_reads.sql`
- Test: `supabase/tests/database/conversation_reads.test.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `public.conversation_reads`; `public.mark_conversation_read(p_conversation_id bigint, p_last_message_id bigint) returns void`; `public.unread_message_count() returns integer`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/conversation_reads.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_table('public', 'conversation_reads', 'read tracking table exists');

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'stranger@test.local', now());

insert into public.shops (id, owner_id, name, slug)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

insert into public.messages (id, conversation_id, sender_id, body, idempotency_key)
overriding system value
values
  (9001, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Hola', gen_random_uuid()),
  (9002, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sigo aquí', gen_random_uuid()),
  (9003, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Gracias', gen_random_uuid());

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select is(public.unread_message_count(), 2, 'with no read row every message from the other party is unread');

select lives_ok(
  $$select public.mark_conversation_read(900, 9001)$$,
  'a participant may mark their own read position'
);

select is(public.unread_message_count(), 1, 'marking read clears the messages up to that point');

select lives_ok(
  $$select public.mark_conversation_read(900, 9001)$$,
  'an out of order call is accepted'
);

select is(
  (select last_read_message_id from public.conversation_reads
   where conversation_id = 900 and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  9001::bigint,
  'a repeated older position never regresses the stored one'
);

set local request.jwt.claims = '{"sub": "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "role": "authenticated"}';

select throws_ok(
  $$select public.mark_conversation_read(900, 9001)$$,
  '42501',
  null,
  'a stranger cannot mark a conversation read'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db supabase/tests/database/conversation_reads.test.sql`
Expected: FAIL — `relation "public.conversation_reads" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260823091000_add_conversation_reads.sql`:

```sql
-- Unread state is per person, not per message, so one row per participant per
-- conversation is enough. Anything newer than the stored id and sent by the
-- other party is unread.
create table public.conversation_reads (
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_message_id bigint not null references public.messages (id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

grant select on table public.conversation_reads to authenticated;

alter table public.conversation_reads enable row level security;

-- Read state is personal. Administrators have no arbitration interest in it.
create policy conversation_reads_are_personal on public.conversation_reads
for select to authenticated
using (user_id = (select auth.uid()));

create function private.is_conversation_participant(p_conversation_id bigint, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.shops s on s.id = c.shop_id
    where c.id = p_conversation_id
      and (c.buyer_id = p_user_id or s.owner_id = p_user_id)
  )
$$;

revoke execute on function private.is_conversation_participant(bigint, uuid)
from public, anon, authenticated;

create function public.mark_conversation_read(p_conversation_id bigint, p_last_message_id bigint)
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

  if not private.is_conversation_participant(p_conversation_id, v_user) then
    raise exception using errcode = '42501', message = 'No participas en esta conversación.';
  end if;

  if not exists (
    select 1 from public.messages
    where id = p_last_message_id and conversation_id = p_conversation_id
  ) then
    raise exception using errcode = '22023', message = 'Ese mensaje no pertenece a esta conversación.';
  end if;

  insert into public.conversation_reads (conversation_id, user_id, last_read_message_id)
  values (p_conversation_id, v_user, p_last_message_id)
  on conflict (conversation_id, user_id) do update
    -- A slow request finishing out of order must never resurrect read messages.
    set last_read_message_id = greatest(
          excluded.last_read_message_id,
          public.conversation_reads.last_read_message_id
        ),
        updated_at = now();
end;
$$;

revoke all on function public.mark_conversation_read(bigint, bigint) from public, anon;
grant execute on function public.mark_conversation_read(bigint, bigint) to authenticated;

create function public.unread_message_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(count(*), 0)::integer
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.shops s on s.id = c.shop_id
  left join public.conversation_reads r
    on r.conversation_id = c.id and r.user_id = auth.uid()
  where (c.buyer_id = auth.uid() or s.owner_id = auth.uid())
    and m.sender_id <> auth.uid()
    and (r.last_read_message_id is null or m.id > r.last_read_message_id)
$$;

revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

-- Rollback:
-- drop function public.unread_message_count();
-- drop function public.mark_conversation_read(bigint, bigint);
-- drop function private.is_conversation_participant(bigint, uuid);
-- drop table public.conversation_reads;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && supabase test db supabase/tests/database/conversation_reads.test.sql`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823091000_add_conversation_reads.sql supabase/tests/database/conversation_reads.test.sql
git commit -m "feat: track where each person stopped reading a conversation"
```

---

### Task 4: The inbox query

**Files:**
- Create: `supabase/migrations/20260823092000_add_list_conversations.sql`
- Test: `supabase/tests/database/list_conversations.test.sql`

**Interfaces:**
- Consumes: `private.display_label` (Task 1), `public.conversation_reads` (Task 3).
- Produces: `public.list_conversations(p_role text)` returning `conversation_id bigint, type text, order_id bigint, shop_id bigint, shop_name text, shop_slug text, counterpart_label text, last_message_body text, last_message_at timestamptz, last_message_sender_id uuid, unread_count integer`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/list_conversations.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.user_display_names (user_id, display_name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Ana Ruiz');

insert into public.shops (id, owner_id, name, slug)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

insert into public.messages (id, conversation_id, sender_id, body, idempotency_key)
overriding system value
values
  (9001, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Hola', gen_random_uuid()),
  (9002, 900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Sigo aquí', gen_random_uuid());

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select results_eq(
  $$select counterpart_label from public.list_conversations('buyer')$$,
  array['Tienda Prueba'::text],
  'a buyer sees the shop name'
);

select results_eq(
  $$select last_message_body from public.list_conversations('buyer')$$,
  array['Sigo aquí'::text],
  'the newest message is the one shown'
);

select results_eq(
  $$select unread_count from public.list_conversations('buyer')$$,
  array[2],
  'unread counts arrive with the row'
);

select is_empty(
  $$select 1 from public.list_conversations('seller')$$,
  'a buyer asking for seller threads gets none'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "role": "authenticated"}';

select results_eq(
  $$select counterpart_label from public.list_conversations('seller')$$,
  array['Ana Ruiz'::text],
  'a seller sees the buyer display name'
);

select throws_ok(
  $$select public.list_conversations('admin')$$,
  '22023',
  null,
  'an unknown role is refused'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db supabase/tests/database/list_conversations.test.sql`
Expected: FAIL — `function public.list_conversations(unknown) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260823092000_add_list_conversations.sql`:

```sql
-- One query per inbox: the thread, its newest message and the unread count.
-- The newest message comes from a lateral join rather than a denormalized
-- column, so there is never a second copy of message text to keep consistent.
create function public.list_conversations(p_role text)
returns table (
  conversation_id bigint,
  type text,
  order_id bigint,
  shop_id bigint,
  shop_name text,
  shop_slug text,
  counterpart_label text,
  last_message_body text,
  last_message_at timestamptz,
  last_message_sender_id uuid,
  unread_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if p_role not in ('buyer', 'seller') then
    raise exception using errcode = '22023', message = 'Rol inválido.';
  end if;

  return query
  select
    c.id,
    c.type,
    c.order_id,
    c.shop_id,
    s.name,
    s.slug,
    case
      when p_role = 'buyer' then s.name
      else private.display_label(c.buyer_id, d.display_name)
    end,
    lm.body,
    lm.created_at,
    lm.sender_id,
    (
      select count(*)
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> v_user
        and (r.last_read_message_id is null or m.id > r.last_read_message_id)
    )::integer
  from public.conversations c
  join public.shops s on s.id = c.shop_id
  left join public.user_display_names d on d.user_id = c.buyer_id
  left join public.conversation_reads r
    on r.conversation_id = c.id and r.user_id = v_user
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.id desc
    limit 1
  ) lm on true
  where (p_role = 'buyer' and c.buyer_id = v_user)
     or (p_role = 'seller' and s.owner_id = v_user)
  order by c.updated_at desc;
end;
$$;

revoke all on function public.list_conversations(text) from public, anon;
grant execute on function public.list_conversations(text) to authenticated;

-- Rollback:
-- drop function public.list_conversations(text);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && supabase test db supabase/tests/database/list_conversations.test.sql`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823092000_add_list_conversations.sql supabase/tests/database/list_conversations.test.sql
git commit -m "feat: list a person's conversations with their unread counts"
```

---

### Task 5: Restrict the seller response clock to order conversations

**Files:**
- Create: `supabase/migrations/20260823093000_response_clock_orders_only.sql`
- Test: `supabase/tests/database/response_clock_scope.test.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: a replaced `private.record_message_evidence()`. No signature change; the trigger keeps its name.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/response_clock_scope.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba');

insert into public.conversations (id, shop_id, buyer_id, type, updated_at)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale', '2020-01-01T00:00:00Z');

insert into public.messages (conversation_id, sender_id, body, idempotency_key)
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '¿Tienes talla 8?', gen_random_uuid());

select is_empty(
  $$select 1 from public.seller_response_events where conversation_id = 900$$,
  'a pre-sale message starts no seller response clock'
);

select isnt(
  (select updated_at from public.conversations where id = 900),
  '2020-01-01T00:00:00Z'::timestamptz,
  'a pre-sale message still bumps the conversation so the inbox sorts by it'
);

select is_empty(
  $$select 1 from public.seller_activity_events
    where shop_id = 900 and activity_type = 'seller_message'$$,
  'a pre-sale exchange records no seller activity'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db supabase/tests/database/response_clock_scope.test.sql`
Expected: FAIL on the first assertion — a `seller_response_events` row exists, because today's trigger fires for every conversation type.

- [ ] **Step 3: Write the migration**

**Base the rewrite on the body in `20260820191826_add_buyer_trust_system.sql:457`,
not on the one in `20260820173552_add_fulfillment_communication.sql`.** The buyer
trust system already replaced this function to also drive buyer response clocks,
and its buyer-side branches are already scoped to order conversations. Copying
the older body silently reverts that work — the `buyer_trust_evidence` pgTAP file
catches it, but only if the whole suite is run. The only edits this task makes
are the two `if v_conversation.type = 'order'` guards around the seller-side
effects, and keeping the `updated_at` bump unconditional.

Create `supabase/migrations/20260823093000_response_clock_orders_only.sql`:

```sql
-- Pre-sale conversations had no interface until the messaging system shipped,
-- so no pre-sale message ever reached this trigger. Opening that surface would
-- have quietly changed what the published seller response metric measures, and
-- would have let anyone drag a shop's response rate down by opening threads
-- they never intended to buy from. The clock stays on order conversations,
-- matching the buyer-side exclusion already approved in the buyer trust spec.
create or replace function private.record_message_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.conversations%rowtype;
  v_owner_id uuid;
  v_event_id bigint;
  v_elapsed integer;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  select owner_id into v_owner_id from public.shops where id = v_conversation.shop_id;

  -- The bump drives inbox ordering and applies to every conversation type.
  update public.conversations set updated_at = new.created_at where id = new.conversation_id;

  if v_conversation.type <> 'order' then
    return new;
  end if;

  if new.sender_id = v_conversation.buyer_id and new.sender_id <> v_owner_id then
    insert into public.seller_response_events (
      conversation_id, shop_id, triggering_buyer_message_id, clock_started_at
    ) values (new.conversation_id, v_conversation.shop_id, new.id, new.created_at)
    on conflict (conversation_id) where replied_at is null do nothing;
  elsif new.sender_id = v_owner_id then
    select id, greatest(0, floor(extract(epoch from (new.created_at - clock_started_at)) / 60)::integer)
    into v_event_id, v_elapsed
    from public.seller_response_events
    where conversation_id = new.conversation_id and replied_at is null
    order by clock_started_at
    limit 1
    for update;

    if v_event_id is not null then
      update public.seller_response_events
      set closing_seller_message_id = new.id,
          replied_at = new.created_at,
          elapsed_minutes = v_elapsed,
          answered_within_24_hours = v_elapsed <= 1440
      where id = v_event_id;
    end if;

    perform private.record_seller_activity(
      v_conversation.shop_id, new.sender_id, 'seller_message', 'message', new.id
    );
  end if;

  return new;
end;
$$;

-- Rollback: restore the body from 20260820173552_add_fulfillment_communication.sql,
-- which measures every conversation type.
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `supabase db reset && supabase test db supabase/tests/database`
Expected: PASS. The whole suite runs because this changes shipped trust behavior — `fulfillment_communication.test.sql` and `trust_tier_evaluator.test.sql` must still pass, proving order conversations are unaffected.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823093000_response_clock_orders_only.sql supabase/tests/database/response_clock_scope.test.sql
git commit -m "fix: keep the seller response clock on order conversations"
```

---

### Task 6: Rate limits on sending and on opening threads

**Files:**
- Create: `supabase/migrations/20260823094000_message_rate_limits.sql`
- Test: `supabase/tests/database/message_rate_limits.test.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `private.message_rate_limits`; replaced `public.send_conversation_message(bigint, text, uuid)` and `public.start_pre_sale_conversation(bigint)`, both keeping their signatures; `private.prune_message_rate_limits()`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/message_rate_limits.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

-- Burn the hourly allowance.
do $$
declare i integer;
begin
  for i in 1..60 loop
    perform public.send_conversation_message(900, 'mensaje ' || i, gen_random_uuid());
  end loop;
end;
$$;

select throws_ok(
  $$select public.send_conversation_message(900, 'uno de más', gen_random_uuid())$$,
  'P0001',
  'Enviaste demasiados mensajes. Intenta de nuevo en un rato.',
  'the sixty-first message in an hour is refused'
);

select is(
  (select sent_count from private.message_rate_limits
   where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
     and window_hour = date_trunc('hour', now())),
  60,
  'a refused send does not inflate the counter'
);

select is(
  (select count(*) from public.messages where conversation_id = 900)::integer,
  60,
  'a refused send stores no message'
);

-- Idempotent replay must not consume quota, so reset and prove a repeat is free.
delete from private.message_rate_limits
where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$select public.send_conversation_message(
      900,
      'mensaje 1',
      (select idempotency_key from public.messages where conversation_id = 900 order by id limit 1)
    )$$,
  'replaying a message the server already stored is accepted'
);

select is(
  (select count(*) from public.messages where conversation_id = 900)::integer,
  60,
  'a replay stores no second copy'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db supabase/tests/database/message_rate_limits.test.sql`
Expected: FAIL on the first assertion — the sixty-first send currently succeeds.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260823094000_message_rate_limits.sql`:

```sql
-- Pre-sale chat lets any signed-in account reach any shop, which is a spam
-- surface the order-only system never had. Counters follow the shape already
-- used by private.telemetry_rate_limits: hourly buckets, written only by
-- security-definer functions, unreachable from a browser role.
create table private.message_rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  window_hour timestamptz not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  conversations_opened integer not null default 0 check (conversations_opened >= 0),
  primary key (user_id, window_hour)
);

revoke all on table private.message_rate_limits from public, anon, authenticated;

create function private.prune_message_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.message_rate_limits where window_hour < now() - interval '24 hours'
$$;

revoke execute on function private.prune_message_rate_limits() from public, anon, authenticated;

create or replace function public.send_conversation_message(
  p_conversation_id bigint,
  p_body text,
  p_idempotency_key uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id bigint;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  if not exists (
    select 1 from public.conversations c join public.shops s on s.id = c.shop_id
    where c.id = p_conversation_id and (c.buyer_id = v_user or s.owner_id = v_user)
  ) then
    raise exception using errcode = '42501', message = 'No puedes escribir en esta conversación.';
  end if;

  if char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'El mensaje debe tener entre 1 y 2000 caracteres.';
  end if;

  -- The idempotency check stays ahead of the rate limit: a retry of a message
  -- the server already stored is the client being careful, not a new send.
  select id into v_id from public.messages
  where conversation_id = p_conversation_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;

  insert into private.message_rate_limits (user_id, window_hour, sent_count)
  values (v_user, date_trunc('hour', now()), 1)
  on conflict (user_id, window_hour) do update
    set sent_count = private.message_rate_limits.sent_count + 1
    where private.message_rate_limits.sent_count < 60;

  if not found then
    raise exception using errcode = 'P0001',
      message = 'Enviaste demasiados mensajes. Intenta de nuevo en un rato.';
  end if;

  insert into public.messages (conversation_id, sender_id, body, idempotency_key)
  values (p_conversation_id, v_user, btrim(p_body), p_idempotency_key)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.start_pre_sale_conversation(p_shop_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_id bigint;
  v_opened integer;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Debes iniciar sesión.';
  end if;

  select owner_id into v_owner from public.shops where id = p_shop_id;
  if v_owner is null then
    raise exception using errcode = 'P0002', message = 'Tienda no encontrada.';
  end if;
  if v_owner = v_user then
    raise exception using errcode = 'P0001', message = 'No puedes abrir una conversación contigo.';
  end if;

  -- Re-opening a thread that already exists is free. Only a genuinely new
  -- conversation spends quota, so a returning shopper is never throttled for
  -- coming back to a shop they already talked to.
  select id into v_id from public.conversations
  where buyer_id = v_user and shop_id = p_shop_id and type = 'pre_sale';

  if v_id is not null then
    update public.conversations set updated_at = now() where id = v_id;
    return v_id;
  end if;

  select coalesce(sum(conversations_opened), 0) into v_opened
  from private.message_rate_limits
  where user_id = v_user and window_hour > now() - interval '24 hours';

  if v_opened >= 10 then
    raise exception using errcode = 'P0001',
      message = 'Abriste demasiadas conversaciones hoy. Intenta de nuevo mañana.';
  end if;

  insert into public.conversations (shop_id, buyer_id, type)
  values (p_shop_id, v_user, 'pre_sale')
  returning id into v_id;

  insert into private.message_rate_limits (user_id, window_hour, conversations_opened)
  values (v_user, date_trunc('hour', now()), 1)
  on conflict (user_id, window_hour) do update
    set conversations_opened = private.message_rate_limits.conversations_opened + 1;

  return v_id;
end;
$$;

-- Rollback, only after callers no longer depend on rate limiting:
-- restore both function bodies from 20260820173552_add_fulfillment_communication.sql
-- drop function private.prune_message_rate_limits();
-- drop table private.message_rate_limits;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `supabase db reset && supabase test db supabase/tests/database`
Expected: PASS. The full suite runs because both replaced functions are covered by `fulfillment_communication.test.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823094000_message_rate_limits.sql supabase/tests/database/message_rate_limits.test.sql
git commit -m "feat: bound how fast one account can message shops"
```

---

### Task 7: Audited administrator reads

**Files:**
- Create: `supabase/migrations/20260823095000_admin_read_audit.sql`
- Test: `supabase/tests/database/admin_read_audit.test.sql`

**Interfaces:**
- Consumes: `private.display_label` (Task 1).
- Produces: `public.admin_read_events`; `public.read_conversation_as_admin(p_conversation_id bigint, p_reason text)` returning `id bigint, sender_id uuid, sender_label text, body text, created_at timestamptz`. Removes the administrator branch from `conversation_participants_select` and `message_participants_select`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/admin_read_audit.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'admin@test.local', now());

insert into private.admin_users (user_id) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd');

insert into public.shops (id, owner_id, name, slug)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba');

insert into public.conversations (id, shop_id, buyer_id, type)
overriding system value
values (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale');

insert into public.messages (conversation_id, sender_id, body, idempotency_key)
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Nunca llegó', gen_random_uuid());

set local role authenticated;
set local request.jwt.claims = '{"sub": "dddddddd-dddd-4ddd-8ddd-dddddddddddd", "role": "authenticated"}';

select is_empty(
  $$select 1 from public.messages$$,
  'an administrator can no longer read messages straight through row level security'
);

select results_eq(
  $$select body from public.read_conversation_as_admin(900, 'Disputa 12: el comprador dice que no llegó')$$,
  array['Nunca llegó'::text],
  'an administrator reads the conversation through the audited path'
);

select is(
  (select count(*) from public.admin_read_events where conversation_id = 900)::integer,
  1,
  'the read is recorded'
);

select results_eq(
  $$select reason from public.admin_read_events where conversation_id = 900$$,
  array['Disputa 12: el comprador dice que no llegó'::text],
  'the stated reason is stored'
);

select throws_ok(
  $$select public.read_conversation_as_admin(900, '')$$,
  '22023',
  null,
  'a read without a reason is refused'
);

set local request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "role": "authenticated"}';

select throws_ok(
  $$select public.read_conversation_as_admin(900, 'curiosidad')$$,
  '42501',
  null,
  'a participant cannot use the administrator path'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db supabase/tests/database/admin_read_audit.test.sql`
Expected: FAIL on the first assertion — the administrator still reads messages directly.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260823095000_admin_read_audit.sql`:

```sql
-- Administrators could read any conversation through row level security,
-- leaving no trace of who looked or why. They keep the capability, because
-- disputes need it, but every use is now attributable.
create table public.admin_read_events (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id) on delete restrict,
  conversation_id bigint not null references public.conversations (id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default now()
);

create index admin_read_events_conversation_idx
on public.admin_read_events (conversation_id, created_at desc);

grant select on table public.admin_read_events to authenticated;
grant usage, select on sequence public.admin_read_events_id_seq to authenticated;

alter table public.admin_read_events enable row level security;

-- The audit trail is reviewable by administration itself.
create policy admin_read_events_admin_select on public.admin_read_events
for select to authenticated
using ((select public.is_current_user_admin()));

drop policy conversation_participants_select on public.conversations;
create policy conversation_participants_select on public.conversations
for select to authenticated
using (
  buyer_id = (select auth.uid())
  or exists (
    select 1 from public.shops
    where shops.id = conversations.shop_id and shops.owner_id = (select auth.uid())
  )
);

drop policy message_participants_select on public.messages;
create policy message_participants_select on public.messages
for select to authenticated
using (exists (
  select 1 from public.conversations c join public.shops s on s.id = c.shop_id
  where c.id = messages.conversation_id
    and (c.buyer_id = (select auth.uid()) or s.owner_id = (select auth.uid()))
));

create function public.read_conversation_as_admin(p_conversation_id bigint, p_reason text)
returns table (
  id bigint,
  sender_id uuid,
  sender_label text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not (select public.is_current_user_admin()) then
    raise exception using errcode = '42501', message = 'Solo administración puede abrir una conversación.';
  end if;

  if char_length(v_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'Escribe el motivo de la consulta.';
  end if;

  if not exists (select 1 from public.conversations where public.conversations.id = p_conversation_id) then
    raise exception using errcode = 'P0002', message = 'Conversación no encontrada.';
  end if;

  -- Recorded before the rows are returned, in the same transaction, so a read
  -- cannot succeed without leaving its trace.
  insert into public.admin_read_events (admin_id, conversation_id, reason)
  values (v_user, p_conversation_id, v_reason);

  return query
  select
    m.id,
    m.sender_id,
    case
      when m.sender_id = c.buyer_id then private.display_label(c.buyer_id, d.display_name)
      else s.name
    end,
    m.body,
    m.created_at
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.shops s on s.id = c.shop_id
  left join public.user_display_names d on d.user_id = c.buyer_id
  where m.conversation_id = p_conversation_id
  order by m.id;
end;
$$;

revoke all on function public.read_conversation_as_admin(bigint, text) from public, anon;
grant execute on function public.read_conversation_as_admin(bigint, text) to authenticated;

-- Rollback:
-- drop function public.read_conversation_as_admin(bigint, text);
-- restore the administrator branches on both policies from 20260820173553_add_reviews_disputes.sql
-- drop table public.admin_read_events;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `supabase db reset && supabase test db supabase/tests/database`
Expected: PASS. `marketplace_rls.test.sql` and any dispute test asserting administrator reach must be re-read; if one asserts an administrator selecting `public.messages` directly, update it to use the audited function and note the change in the commit body.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823095000_admin_read_audit.sql supabase/tests/database/admin_read_audit.test.sql
git commit -m "feat: record who read a conversation and why"
```

---

### Task 8: Retention purge and the realtime publication

**Files:**
- Create: `supabase/migrations/20260823096000_message_retention_and_realtime.sql`
- Test: `supabase/tests/database/message_retention.test.sql`

**Interfaces:**
- Consumes: `public.conversation_reads` (Task 3), `private.prune_message_rate_limits` (Task 6).
- Produces: `private.purge_idle_pre_sale_conversations()`; a `messaging-presale-purge` cron job; `public.messages` added to the `supabase_realtime` publication.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/database/message_retention.test.sql`:

```sql
begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, email, created_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'buyer@test.local', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'seller@test.local', now());

insert into public.shops (id, owner_id, name, slug)
overriding system value
values (900, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tienda Prueba', 'tienda-prueba');

insert into public.conversations (id, shop_id, buyer_id, type, updated_at)
overriding system value
values
  (900, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale', now() - interval '200 days'),
  (901, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'pre_sale', now() - interval '10 days');

insert into public.messages (id, conversation_id, sender_id, body, idempotency_key)
overriding system value
values
  (9001, 900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Viejo', gen_random_uuid()),
  (9002, 901, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Reciente', gen_random_uuid());

insert into public.conversation_reads (conversation_id, user_id, last_read_message_id)
values (900, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 9001);

select lives_ok(
  $$select private.purge_idle_pre_sale_conversations()$$,
  'the purge runs even with read rows and messages referencing the conversation'
);

select is_empty(
  $$select 1 from public.conversations where id = 900$$,
  'an idle pre-sale conversation is purged'
);

select isnt_empty(
  $$select 1 from public.conversations where id = 901$$,
  'a recent pre-sale conversation is kept'
);

select is(
  (select count(*) from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages')::integer,
  1,
  'messages are published for realtime delivery'
);

select * from finish();

rollback;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase test db supabase/tests/database/message_retention.test.sql`
Expected: FAIL — `function private.purge_idle_pre_sale_conversations() does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260823096000_message_retention_and_realtime.sql`:

```sql
-- Pre-sale threads accumulate from browsing rather than from buying, so they
-- age out. Order conversations never do: disputes and reviews depend on them.
create function private.purge_idle_pre_sale_conversations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from public.conversations
  where type = 'pre_sale' and updated_at < now() - interval '180 days';

  if array_length(v_ids, 1) is null then return; end if;

  -- Every foreign key onto these tables is on delete restrict, so the deletes
  -- go in dependency order inside one transaction.
  delete from public.conversation_reads where conversation_id = any (v_ids);
  delete from public.messages where conversation_id = any (v_ids);
  delete from public.conversations where id = any (v_ids);
end;
$$;

revoke execute on function private.purge_idle_pre_sale_conversations()
from public, anon, authenticated;

create function private.run_messaging_maintenance()
returns void
language sql
security definer
set search_path = ''
as $$
  select private.purge_idle_pre_sale_conversations();
  select private.prune_message_rate_limits();
$$;

revoke execute on function private.run_messaging_maintenance() from public, anon, authenticated;

select cron.schedule(
  'messaging-presale-purge',
  '30 3 * * *',
  $$select private.run_messaging_maintenance()$$
);

-- Realtime delivery. Change events are filtered by the participant policy
-- above, so publishing this table adds no read surface.
alter publication supabase_realtime add table public.messages;

-- Rollback:
-- alter publication supabase_realtime drop table public.messages;
-- select cron.unschedule('messaging-presale-purge');
-- drop function private.run_messaging_maintenance();
-- drop function private.purge_idle_pre_sale_conversations();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `supabase db reset && supabase test db supabase/tests/database/message_retention.test.sql`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260823096000_message_retention_and_realtime.sql supabase/tests/database/message_retention.test.sql
git commit -m "feat: age out idle pre-sale threads and publish messages for realtime"
```

---

### Task 9: Types, the display-name fallback, and inbox mappers

**Files:**
- Modify: `lib/database.types.ts`
- Create: `lib/display-name.ts`
- Create: `lib/display-name.test.ts`
- Create: `lib/queries/messages.ts`
- Create: `lib/queries/messages.test.ts`

**Interfaces:**
- Consumes: the RPC signatures from Tasks 1, 3, 4 and 7.
- Produces: `displayNameOrHandle(name: string | null, userId: string): string`; types `ConversationSummary`, `ThreadMessage`, `Thread`, `InboxRole`; `mapConversationRows(rows: ConversationRow[]): ConversationSummary[]`; `oldestFirst<T extends { created_at: string }>(entries: T[]): T[]`.

- [ ] **Step 1: Write the failing tests**

Create `lib/display-name.test.ts`:

```ts
import { expect, test } from "vitest";

import { displayNameOrHandle } from "@/lib/display-name";

test("uses the name a person set", () => {
  expect(displayNameOrHandle("Ana Ruiz", "3333cccc-cccc-4ccc-8ccc-cccccccccccc")).toBe("Ana Ruiz");
});

test("falls back to a stable handle when there is no name", () => {
  expect(displayNameOrHandle(null, "3333cccc-cccc-4ccc-8ccc-cccccccccccc")).toBe("Comprador #3333");
});

test("treats a blank name as no name", () => {
  expect(displayNameOrHandle("   ", "3333cccc-cccc-4ccc-8ccc-cccccccccccc")).toBe("Comprador #3333");
});

test("matches the handle the database builds", () => {
  // private.display_label strips dashes, takes four characters, uppercases.
  expect(displayNameOrHandle(null, "ab12cdef-0000-4000-8000-000000000000")).toBe("Comprador #AB12");
});
```

Create `lib/queries/messages.test.ts`:

```ts
import { expect, test } from "vitest";

import { mapConversationRows, oldestFirst } from "@/lib/queries/messages";

const row = {
  conversation_id: 7,
  type: "pre_sale" as const,
  order_id: null,
  shop_id: 3,
  shop_name: "Tienda Prueba",
  shop_slug: "tienda-prueba",
  counterpart_label: "Ana Ruiz",
  last_message_body: "Hola",
  last_message_at: "2026-08-23T10:00:00Z",
  last_message_sender_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  unread_count: 2,
};

test("carries the row through with its unread count", () => {
  const [summary] = mapConversationRows([row]);

  expect(summary.id).toBe(7);
  expect(summary.unread_count).toBe(2);
  expect(summary.counterpart_label).toBe("Ana Ruiz");
});

test("represents a thread with no messages yet", () => {
  const [summary] = mapConversationRows([
    { ...row, last_message_body: null, last_message_at: null, last_message_sender_id: null },
  ]);

  expect(summary.last_message).toBeNull();
});

test("sorts messages oldest first", () => {
  const sorted = oldestFirst([
    { id: 2, created_at: "2026-08-23T11:00:00Z" },
    { id: 1, created_at: "2026-08-23T10:00:00Z" },
  ]);

  expect(sorted.map((entry) => entry.id)).toEqual([1, 2]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/display-name.test.ts lib/queries/messages.test.ts`
Expected: FAIL — neither module resolves.

- [ ] **Step 3: Write the implementation**

Create `lib/display-name.ts`:

```ts
/**
 * The label for a person in a conversation.
 *
 * Accounts that predate display names, and anyone who has not set one, read as
 * a handle derived from their id. It is stable, so a seller still recognises a
 * shopper who comes back. This mirrors `private.display_label` in SQL; the two
 * must agree, because a seller sees the database's answer in the inbox and this
 * one in a thread.
 */
export function displayNameOrHandle(name: string | null, userId: string) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;

  return `Comprador #${userId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}
```

Create `lib/queries/messages.ts`:

```ts
export type InboxRole = "buyer" | "seller";

export type ConversationRow = {
  conversation_id: number;
  type: "pre_sale" | "order";
  order_id: number | null;
  shop_id: number;
  shop_name: string;
  shop_slug: string;
  counterpart_label: string;
  last_message_body: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
};

export type ConversationSummary = {
  id: number;
  type: "pre_sale" | "order";
  order_id: number | null;
  shop_id: number;
  shop_name: string;
  shop_slug: string;
  counterpart_label: string;
  unread_count: number;
  last_message: { body: string; created_at: string; sender_id: string } | null;
};

export type ThreadMessage = {
  id: number;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Thread = {
  id: number;
  type: "pre_sale" | "order";
  order_id: number | null;
  counterpart_label: string;
  current_user_id: string;
  messages: ThreadMessage[];
};

export function oldestFirst<T extends { created_at: string }>(entries: T[]) {
  return [...entries].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function mapConversationRows(rows: ConversationRow[]): ConversationSummary[] {
  return rows.map((row) => ({
    id: row.conversation_id,
    type: row.type,
    order_id: row.order_id,
    shop_id: row.shop_id,
    shop_name: row.shop_name,
    shop_slug: row.shop_slug,
    counterpart_label: row.counterpart_label,
    unread_count: row.unread_count,
    // A thread opened but never written in has no message to preview.
    last_message:
      row.last_message_body && row.last_message_at && row.last_message_sender_id
        ? {
            body: row.last_message_body,
            created_at: row.last_message_at,
            sender_id: row.last_message_sender_id,
          }
        : null,
  }));
}
```

In `lib/database.types.ts`, add the new tables to the `Tables` block following the existing style, and the new functions to the `Functions` block:

```ts
user_display_names: {
  Row: { user_id: string; display_name: string; updated_at: string };
  Insert: { user_id: string; display_name: string; updated_at?: string };
  Update: { user_id?: string; display_name?: string; updated_at?: string };
};
conversation_reads: {
  Row: { conversation_id: number; user_id: string; last_read_message_id: number; updated_at: string };
  Insert: { conversation_id: number; user_id: string; last_read_message_id: number; updated_at?: string };
  Update: { conversation_id?: number; user_id?: string; last_read_message_id?: number; updated_at?: string };
};
admin_read_events: {
  Row: { id: number; admin_id: string; conversation_id: number; reason: string; created_at: string };
  Insert: { id?: never; admin_id: string; conversation_id: number; reason: string; created_at?: string };
  Update: { id?: never; admin_id?: string; conversation_id?: number; reason?: string; created_at?: string };
};
```

```ts
set_display_name: { Args: { p_display_name: string }; Returns: undefined };
my_display_name: { Args: Record<string, never>; Returns: string | null };
mark_conversation_read: { Args: { p_conversation_id: number; p_last_message_id: number }; Returns: undefined };
unread_message_count: { Args: Record<string, never>; Returns: number };
list_conversations: {
  Args: { p_role: string };
  Returns: {
    conversation_id: number;
    type: "pre_sale" | "order";
    order_id: number | null;
    shop_id: number;
    shop_name: string;
    shop_slug: string;
    counterpart_label: string;
    last_message_body: string | null;
    last_message_at: string | null;
    last_message_sender_id: string | null;
    unread_count: number;
  }[];
};
read_conversation_as_admin: {
  Args: { p_conversation_id: number; p_reason: string };
  Returns: { id: number; sender_id: string; sender_label: string; body: string; created_at: string }[];
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/display-name.test.ts lib/queries/messages.test.ts && npm run typecheck`
Expected: PASS, 7 tests, clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add lib/database.types.ts lib/display-name.ts lib/display-name.test.ts lib/queries/messages.ts lib/queries/messages.test.ts
git commit -m "feat: add the types and mappers the inbox reads through"
```

---

### Task 10: Server fetches and message actions

**Files:**
- Create: `lib/queries/messages.server.ts`
- Create: `lib/validation/message.ts`
- Modify: `lib/actions/messages.ts`
- Test: `lib/actions/messages.test.ts`

**Interfaces:**
- Consumes: `mapConversationRows`, `oldestFirst`, `Thread`, `ConversationSummary`, `InboxRole` (Task 9); the RPCs from Tasks 3, 4 and 6.
- Produces: `listConversations(role: InboxRole): Promise<ConversationSummary[]>`; `fetchThread(conversationId: number): Promise<Thread | null>`; `fetchUnreadCount(): Promise<number>`; actions `sendMessage(conversationId, revalidate, previousState, formData)`, `startPreSaleConversation(shopId)`, `markConversationRead(conversationId, lastMessageId)`.

- [ ] **Step 1: Write the failing test**

Create `lib/actions/messages.test.ts`:

```ts
import { expect, test, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const getClaims = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ rpc, auth: { getClaims } }),
}));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { sendMessage } = await import("@/lib/actions/messages");

beforeEach(() => {
  rpc.mockReset();
  getClaims.mockReset();
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
});

function formOf(body: string) {
  const formData = new FormData();
  formData.set("body", body);
  return formData;
}

test("generates a fresh idempotency key on every send", async () => {
  rpc.mockResolvedValue({ error: null });

  await sendMessage(7, ["/mensajes/7"], { status: "idle", message: "" }, formOf("uno"));
  await sendMessage(7, ["/mensajes/7"], { status: "idle", message: "" }, formOf("dos"));

  const firstKey = rpc.mock.calls[0][1].p_idempotency_key;
  const secondKey = rpc.mock.calls[1][1].p_idempotency_key;

  expect(firstKey).not.toBe(secondKey);
});

test("hands a rate-limit refusal back in the person's own words", async () => {
  rpc.mockResolvedValue({
    error: { code: "P0001", message: "Enviaste demasiados mensajes. Intenta de nuevo en un rato." },
  });

  const state = await sendMessage(7, ["/mensajes/7"], { status: "idle", message: "" }, formOf("uno"));

  expect(state.status).toBe("error");
  expect(state.message).toBe("Enviaste demasiados mensajes. Intenta de nuevo en un rato.");
});

test("keeps what the person typed when a send fails", async () => {
  rpc.mockResolvedValue({ error: { code: "XX000", message: "boom" } });

  const state = await sendMessage(7, ["/mensajes/7"], { status: "idle", message: "" }, formOf("uno"));

  expect(state.values?.body).toBe("uno");
});

test("refuses an empty message without calling the database", async () => {
  const state = await sendMessage(7, ["/mensajes/7"], { status: "idle", message: "" }, formOf("   "));

  expect(state.status).toBe("error");
  expect(rpc).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/actions/messages.test.ts`
Expected: FAIL — `sendMessage` currently takes `(conversationId, orderId, previousState, formData)` and reads the idempotency key from the form.

- [ ] **Step 3: Write the implementation**

Create `lib/validation/message.ts`:

```ts
import { z } from "zod";

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, "Escribe un mensaje.")
  .max(2000, "El mensaje debe tener entre 1 y 2000 caracteres.");
```

Create `lib/queries/messages.server.ts`:

```ts
import "server-only";

import {
  mapConversationRows,
  oldestFirst,
  type ConversationSummary,
  type InboxRole,
  type Thread,
} from "@/lib/queries/messages";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function listConversations(role: InboxRole): Promise<ConversationSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_conversations", { p_role: role });
  if (error || !data) return [];

  return mapConversationRows(data);
}

export async function fetchUnreadCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("unread_message_count");

  return error ? 0 : (data ?? 0);
}

export async function fetchThread(conversationId: number): Promise<Thread | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;

  // The row-level policy already limits this to conversations the caller is in,
  // so a thread that belongs to somebody else simply returns nothing.
  const { data, error } = await supabase
    .from("conversations")
    .select("id, type, order_id, buyer_id, messages(id, sender_id, body, created_at)")
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) return null;

  // The label lives in the inbox query, which already knows to show a shop name
  // to a buyer and a display name to a seller. Asking it again keeps that rule
  // in one place rather than reimplementing it here.
  const role: InboxRole = data.buyer_id === userId ? "buyer" : "seller";
  const summary = (await listConversations(role)).find((entry) => entry.id === conversationId);

  return {
    id: data.id,
    type: data.type,
    order_id: data.order_id,
    counterpart_label: summary?.counterpart_label ?? "Conversación",
    current_user_id: userId,
    messages: oldestFirst(data.messages),
  };
}
```

Rewrite `lib/actions/messages.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { messageBodySchema } from "@/lib/validation/message";

/** Refusals the database writes for a person to read, passed through as they are. */
const USER_FACING_CODES = new Set(["P0001", "22023"]);

export async function sendMessage(
  conversationId: number,
  revalidate: string[],
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = messageBodySchema.safeParse(formData.get("body"));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Mensaje inválido.",
      values: formValues(formData),
    };
  }

  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return { status: "error", message: "Tu sesión terminó. Ingresa nuevamente.", values: formValues(formData) };
  }

  // A fresh key per submit. Generating it during render meant a second message
  // could reuse the first one's key, and the server answers a repeated key with
  // the message it already stored — so the second one vanished silently.
  const { error } = await supabase.rpc("send_conversation_message", {
    p_conversation_id: conversationId,
    p_body: parsed.data,
    p_idempotency_key: crypto.randomUUID(),
  });

  if (error) {
    return {
      status: "error",
      message: USER_FACING_CODES.has(error.code ?? "") ? error.message : "No pudimos enviar el mensaje.",
      values: formValues(formData),
    };
  }

  for (const path of revalidate) revalidatePath(path);

  return { status: "success", message: "Mensaje enviado." };
}

export async function startPreSaleConversation(
  shopId: number,
): Promise<{ conversationId: number } | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("start_pre_sale_conversation", { p_shop_id: shopId });

  if (error) {
    return { error: USER_FACING_CODES.has(error.code ?? "") ? error.message : "No pudimos abrir la conversación." };
  }

  return { conversationId: data };
}

export async function markConversationRead(conversationId: number, lastMessageId: number) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createServerSupabaseClient();
  // Read state is a convenience. A failure here must never break a thread.
  await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId,
    p_last_message_id: lastMessageId,
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/actions/messages.test.ts && npm run typecheck`
Expected: PASS, 4 tests, clean typecheck. The typecheck will flag the two order pages still calling the old `sendMessage` signature; Task 14 fixes them, so at this point confirm the errors are only those two call sites.

- [ ] **Step 5: Commit**

```bash
git add lib/queries/messages.server.ts lib/validation/message.ts lib/actions/messages.ts lib/actions/messages.test.ts
git commit -m "feat: read and write conversations from the server"
```

---

### Task 11: The live thread component

**Files:**
- Create: `components/messages/message-thread.tsx`
- Create: `components/messages/message-thread.test.tsx`
- Delete: `components/orders/conversation.tsx`

**Interfaces:**
- Consumes: `ThreadMessage` (Task 9); `sendMessage` and `markConversationRead` (Task 10); `createBrowserSupabaseClient` from `lib/supabase/client.ts`.
- Produces: `<MessageThread action conversationId currentUserId messages />` where `action` is `(state: ActionState, formData: FormData) => Promise<ActionState>`.

- [ ] **Step 1: Write the failing test**

Create `components/messages/message-thread.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi, beforeEach } from "vitest";

const channel = { on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() };
const removeChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ channel: () => channel, removeChannel }),
}));
vi.mock("@/lib/actions/messages", () => ({ markConversationRead: vi.fn() }));

import { MessageThread } from "@/components/messages/message-thread";

const messages = [
  { id: 1, sender_id: "me", body: "Hola", created_at: "2026-08-23T10:00:00Z" },
  { id: 2, sender_id: "them", body: "¿Sigue disponible?", created_at: "2026-08-23T11:00:00Z" },
];

beforeEach(() => {
  channel.on.mockClear();
  channel.subscribe.mockClear();
});

test("renders the history the server provided", () => {
  render(<MessageThread action={vi.fn()} conversationId={7} currentUserId="me" messages={messages} />);

  expect(screen.getByText("Hola")).toBeInTheDocument();
  expect(screen.getByText("¿Sigue disponible?")).toBeInTheDocument();
});

test("invites a first message when the thread is empty", () => {
  render(<MessageThread action={vi.fn()} conversationId={7} currentUserId="me" messages={[]} />);

  expect(screen.getByText(/aún no hay mensajes/i)).toBeInTheDocument();
});

test("subscribes to new messages in this conversation only", () => {
  render(<MessageThread action={vi.fn()} conversationId={7} currentUserId="me" messages={messages} />);

  expect(channel.on).toHaveBeenCalledWith(
    "postgres_changes",
    expect.objectContaining({ event: "INSERT", table: "messages", filter: "conversation_id=eq.7" }),
    expect.any(Function),
  );
});

test("appends a message that arrives over the socket", async () => {
  render(<MessageThread action={vi.fn()} conversationId={7} currentUserId="me" messages={messages} />);

  const handler = channel.on.mock.calls[0][2];
  handler({ new: { id: 3, sender_id: "them", body: "Sí, hay", created_at: "2026-08-23T12:00:00Z" } });

  expect(await screen.findByText("Sí, hay")).toBeInTheDocument();
});

test("ignores a message it already shows", async () => {
  render(<MessageThread action={vi.fn()} conversationId={7} currentUserId="me" messages={messages} />);

  const handler = channel.on.mock.calls[0][2];
  handler({ new: messages[1] });

  expect(await screen.findAllByText("¿Sigue disponible?")).toHaveLength(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/messages/message-thread.test.tsx`
Expected: FAIL — cannot resolve `@/components/messages/message-thread`.

- [ ] **Step 3: Write the implementation**

Read `node_modules/next/dist/docs/` for the current client-component guidance before writing this file.

Create `components/messages/message-thread.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { markConversationRead } from "@/lib/actions/messages";
import type { ThreadMessage } from "@/lib/queries/messages";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useFormAction } from "@/lib/use-form-action";

export function MessageThread({
  action,
  conversationId,
  currentUserId,
  messages,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  conversationId: number;
  currentUserId: string;
  messages: ThreadMessage[];
}) {
  const [state, formAction, pending] = useFormAction(action);
  const [live, setLive] = useState<ThreadMessage[]>([]);
  const [degraded, setDegraded] = useState(false);
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  // The server render is the truth. Anything the socket delivers is merged on
  // top of it, and a message already rendered is dropped rather than doubled.
  const shown = useMemo(() => {
    const byId = new Map(messages.map((message) => [message.id, message]));
    for (const message of live) byId.set(message.id, message);

    return [...byId.values()].sort((left, right) => left.id - right.id);
  }, [messages, live]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: ThreadMessage }) => setLive((current) => [...current, payload.new]),
      )
      .subscribe((status: string) => {
        // A dropped socket falls back to refreshing, which is how this thread
        // behaved before live delivery existed. It must never read as empty.
        setDegraded(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!degraded) return;

    const refresh = () => router.refresh();
    const timer = setInterval(refresh, 20_000);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [degraded, router]);

  useEffect(() => {
    const latest = shown.at(-1);
    if (!latest) return;

    endRef.current?.scrollIntoView({ block: "end" });
    void markConversationRead(conversationId, latest.id);
  }, [conversationId, shown]);

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6">
      <h2 className="font-display text-2xl font-semibold">Conversación</h2>

      <div className="mt-5 space-y-3">
        {shown.length ? (
          shown.map((message) => (
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.sender_id === currentUserId ? "ml-auto bg-brand text-white" : "bg-background text-ink"
              }`}
              key={message.id}
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p>
              <p className="mt-1 text-xs opacity-70">{formatDate(message.created_at)}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">Aún no hay mensajes.</p>
        )}
        <div ref={endRef} />
      </div>

      <form action={formAction} className="mt-5 space-y-3">
        <label className="sr-only" htmlFor="message-body">Mensaje</label>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-line bg-background p-4"
          defaultValue={state.values?.body}
          id="message-body"
          maxLength={2000}
          name="body"
          placeholder="Escribe un mensaje"
          required
        />
        <button
          className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
          disabled={pending}
          type="submit"
        >
          {pending ? "Enviando…" : "Enviar mensaje"}
        </button>
        {state.message ? (
          <p className={`text-sm ${state.status === "error" ? "text-sale" : "text-success"}`} role="status">
            {state.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}
```

Delete `components/orders/conversation.tsx`. Task 14 moves its two callers over.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/messages/message-thread.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/messages/message-thread.tsx components/messages/message-thread.test.tsx
git rm components/orders/conversation.tsx
git commit -m "feat: deliver messages as they arrive"
```

---

### Task 12: Inbox list and the four routes

**Files:**
- Create: `components/messages/conversation-list.tsx`
- Create: `components/messages/conversation-list.test.tsx`
- Create: `app/mensajes/page.tsx`
- Create: `app/mensajes/[id]/page.tsx`
- Create: `app/panel/mensajes/page.tsx`
- Create: `app/panel/mensajes/[id]/page.tsx`

**Interfaces:**
- Consumes: `listConversations`, `fetchThread` (Task 10); `MessageThread` (Task 11); `ConversationSummary` (Task 9).
- Produces: `<ConversationList basePath conversations />`.

- [ ] **Step 1: Write the failing test**

Create `components/messages/conversation-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ConversationList } from "@/components/messages/conversation-list";

const conversation = {
  id: 7,
  type: "pre_sale" as const,
  order_id: null,
  shop_id: 3,
  shop_name: "Tienda Prueba",
  shop_slug: "tienda-prueba",
  counterpart_label: "Ana Ruiz",
  unread_count: 2,
  last_message: { body: "¿Sigue disponible?", created_at: "2026-08-23T10:00:00Z", sender_id: "them" },
};

test("links each thread to its own page", () => {
  render(<ConversationList basePath="/mensajes" conversations={[conversation]} />);

  expect(screen.getByRole("link", { name: /Ana Ruiz/ })).toHaveAttribute("href", "/mensajes/7");
});

test("shows how many messages are waiting", () => {
  render(<ConversationList basePath="/mensajes" conversations={[conversation]} />);

  expect(screen.getByText("2")).toBeInTheDocument();
});

test("shows no unread marker on a thread that is caught up", () => {
  render(
    <ConversationList basePath="/mensajes" conversations={[{ ...conversation, unread_count: 0 }]} />,
  );

  expect(screen.queryByLabelText(/mensajes sin leer/i)).not.toBeInTheDocument();
});

test("marks which threads belong to an order", () => {
  render(
    <ConversationList
      basePath="/mensajes"
      conversations={[{ ...conversation, type: "order", order_id: 12 }]}
    />,
  );

  expect(screen.getByText(/pedido #12/i)).toBeInTheDocument();
});

test("explains an empty inbox instead of showing nothing", () => {
  render(<ConversationList basePath="/mensajes" conversations={[]} />);

  expect(screen.getByText(/no tienes conversaciones/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/messages/conversation-list.test.tsx`
Expected: FAIL — cannot resolve `@/components/messages/conversation-list`.

- [ ] **Step 3: Write the implementation**

Create `components/messages/conversation-list.tsx`:

```tsx
import Link from "next/link";

import { formatDate } from "@/lib/format";
import type { ConversationSummary } from "@/lib/queries/messages";

export function ConversationList({
  basePath,
  conversations,
}: {
  basePath: string;
  conversations: ConversationSummary[];
}) {
  if (!conversations.length) {
    return <p className="mt-7 text-muted">No tienes conversaciones todavía.</p>;
  }

  return (
    <ul className="mt-7 divide-y divide-line rounded-[2rem] border border-line bg-surface">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <Link className="flex items-start gap-4 p-5 transition-colors hover:bg-background" href={`${basePath}/${conversation.id}`}>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <strong className="truncate font-semibold">{conversation.counterpart_label}</strong>
                {conversation.type === "order" && conversation.order_id ? (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                    Pedido #{conversation.order_id}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-sm text-muted">
                {conversation.last_message?.body ?? "Sin mensajes todavía"}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-2">
              {conversation.last_message ? (
                <span className="text-xs text-muted">{formatDate(conversation.last_message.created_at)}</span>
              ) : null}
              {conversation.unread_count > 0 ? (
                <span
                  aria-label={`${conversation.unread_count} mensajes sin leer`}
                  className="grid min-w-6 place-items-center rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white"
                >
                  {conversation.unread_count}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

Read the Next.js routing guide under `node_modules/next/dist/docs/` before writing the four pages, particularly the current shape of the `params` prop.

Create `app/mensajes/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConversationList } from "@/components/messages/conversation-list";
import { listConversations } from "@/lib/queries/messages.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mensajes" };

export default async function BuyerInboxPage() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/ingresar?continuar=/mensajes");

  const conversations = await listConversations("buyer");

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tus conversaciones</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Mensajes</h1>
      <ConversationList basePath="/mensajes" conversations={conversations} />
    </section>
  );
}
```

Create `app/mensajes/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/messages/message-thread";
import { sendMessage } from "@/lib/actions/messages";
import { fetchThread } from "@/lib/queries/messages.server";
import type { ActionState } from "@/lib/action-state";

export default async function BuyerThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) notFound();

  const thread = await fetchThread(conversationId);
  // A thread the caller does not participate in reads as missing rather than
  // as forbidden, so its existence is never disclosed.
  if (!thread) notFound();

  async function action(state: ActionState, formData: FormData) {
    "use server";
    return sendMessage(conversationId, [`/mensajes/${conversationId}`, "/mensajes"], state, formData);
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/mensajes">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mensajes
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold">{thread.counterpart_label}</h1>
      {thread.order_id ? (
        <Link className="mt-2 inline-flex text-sm font-semibold text-brand" href={`/compras/${thread.order_id}`}>
          Ver el pedido #{thread.order_id}
        </Link>
      ) : null}
      <div className="mt-7">
        <MessageThread
          action={action}
          conversationId={thread.id}
          currentUserId={thread.current_user_id}
          messages={thread.messages}
        />
      </div>
    </section>
  );
}
```

Create `app/panel/mensajes/page.tsx`. The panel layout already enforces the session, so this page does not redirect:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ConversationList } from "@/components/messages/conversation-list";
import { listConversations } from "@/lib/queries/messages.server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Mensajes de tu tienda" };

export default async function SellerInboxPage() {
  if (!isSupabaseConfigured()) return null;

  const conversations = await listConversations("seller");

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mi panel
      </Link>
      <p className="mt-7 text-sm font-semibold uppercase tracking-[0.18em] text-brand">Tus conversaciones</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em]">Mensajes de tu tienda</h1>
      <ConversationList basePath="/panel/mensajes" conversations={conversations} />
    </section>
  );
}
```

Create `app/panel/mensajes/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/messages/message-thread";
import { sendMessage } from "@/lib/actions/messages";
import { fetchThread } from "@/lib/queries/messages.server";
import type { ActionState } from "@/lib/action-state";

export default async function SellerThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) notFound();

  const thread = await fetchThread(conversationId);
  // A thread the caller does not participate in reads as missing rather than
  // as forbidden, so its existence is never disclosed.
  if (!thread) notFound();

  async function action(state: ActionState, formData: FormData) {
    "use server";
    return sendMessage(
      conversationId,
      [`/panel/mensajes/${conversationId}`, "/panel/mensajes"],
      state,
      formData,
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-brand" href="/panel/mensajes">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mensajes
      </Link>
      <h1 className="mt-5 font-display text-3xl font-semibold">{thread.counterpart_label}</h1>
      {thread.order_id ? (
        <Link
          className="mt-2 inline-flex text-sm font-semibold text-brand"
          href={`/panel/pedidos/${thread.order_id}`}
        >
          Ver el pedido #{thread.order_id}
        </Link>
      ) : null}
      <div className="mt-7">
        <MessageThread
          action={action}
          conversationId={thread.id}
          currentUserId={thread.current_user_id}
          messages={thread.messages}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/messages/conversation-list.test.tsx && npm run lint && npm run typecheck`
Expected: PASS, 5 tests. Typecheck still flags the two order pages; Task 14 fixes them.

- [ ] **Step 5: Commit**

```bash
git add components/messages/conversation-list.tsx components/messages/conversation-list.test.tsx app/mensajes app/panel/mensajes
git commit -m "feat: give buyers and sellers an inbox"
```

---

### Task 13: Starting a conversation from a shop or product page

**Files:**
- Create: `components/messages/start-conversation-button.tsx`
- Create: `lib/actions/start-conversation.ts`
- Create: `components/messages/start-conversation-button.test.tsx`
- Modify: `app/tiendas/[slug]/page.tsx`
- Modify: `app/productos/[slug]/page.tsx`

**Interfaces:**
- Consumes: `startPreSaleConversation` (Task 10).
- Produces: `openConversation(shopId: number, previousState: ActionState, formData: FormData): Promise<ActionState>`; `<StartConversationButton action isOwnShop shopId signedIn />`.

- [ ] **Step 1: Write the failing test**

Create `components/messages/start-conversation-button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { StartConversationButton } from "@/components/messages/start-conversation-button";

test("invites a signed-in shopper to write", () => {
  render(<StartConversationButton action={vi.fn()} isOwnShop={false} shopId={3} signedIn />);

  expect(screen.getByRole("button", { name: /mensaje a la tienda/i })).toBeInTheDocument();
});

test("sends a signed-out visitor to sign in instead", () => {
  render(<StartConversationButton action={vi.fn()} isOwnShop={false} shopId={3} signedIn={false} />);

  expect(screen.getByRole("link", { name: /mensaje a la tienda/i })).toHaveAttribute(
    "href",
    "/ingresar?continuar=/mensajes",
  );
});

test("shows nothing to the shop's own owner", () => {
  const { container } = render(
    <StartConversationButton action={vi.fn()} isOwnShop shopId={3} signedIn />,
  );

  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/messages/start-conversation-button.test.tsx`
Expected: FAIL — cannot resolve `@/components/messages/start-conversation-button`.

- [ ] **Step 3: Write the implementation**

Create `lib/actions/start-conversation.ts`:

```ts
"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { startPreSaleConversation } from "@/lib/actions/messages";

export async function openConversation(
  shopId: number,
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const result = await startPreSaleConversation(shopId);
  if ("error" in result) return { status: "error", message: result.error };

  redirect(`/mensajes/${result.conversationId}`);
}
```

Create `components/messages/start-conversation-button.tsx`:

```tsx
"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

export function StartConversationButton({
  action,
  isOwnShop,
  shopId,
  signedIn,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  isOwnShop: boolean;
  shopId: number;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useFormAction(action);

  // A shop owner messaging their own shop is refused by the database anyway.
  // Not offering it is kinder than explaining it.
  if (isOwnShop) return null;

  const label = "Mensaje a la tienda";
  const className =
    "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-brand transition-colors hover:border-brand";

  if (!signedIn) {
    return (
      <Link className={className} href="/ingresar?continuar=/mensajes">
        <MessageCircle aria-hidden="true" className="size-4" />
        {label}
      </Link>
    );
  }

  return (
    <form action={formAction}>
      <input name="shop_id" type="hidden" value={shopId} />
      <button className={className} disabled={pending} type="submit">
        <MessageCircle aria-hidden="true" className="size-4" />
        {pending ? "Abriendo…" : label}
      </button>
      {state.message ? (
        <p className="mt-2 text-sm text-sale" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
```

In `app/tiendas/[slug]/page.tsx`, resolve the viewer and render the button near the shop heading:

```tsx
const { data: claims } = await supabase.auth.getClaims();
const viewerId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

async function action(state: ActionState, formData: FormData) {
  "use server";
  return openConversation(shop.id, state, formData);
}
```

```tsx
<StartConversationButton
  action={action}
  isOwnShop={viewerId === shop.owner_id}
  shopId={shop.id}
  signedIn={Boolean(viewerId)}
/>
```

Apply the same change in `app/productos/[slug]/page.tsx`, using the product's shop id and owner, placed beside the add-to-cart form. If either page does not already select `owner_id` on the shop, add it to that select.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/messages/start-conversation-button.test.tsx && npm run typecheck`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/messages/start-conversation-button.tsx components/messages/start-conversation-button.test.tsx lib/actions/start-conversation.ts app/tiendas app/productos
git commit -m "feat: let a shopper ask a question before buying"
```

---

### Task 14: The header badge, and moving the order pages onto the shared thread

**Files:**
- Modify: `components/layout/site-header.tsx`
- Modify: `app/compras/[id]/page.tsx`
- Modify: `app/panel/pedidos/[id]/page.tsx`
- Modify: `app/panel/pedidos/[id]/page.test.tsx`

**Interfaces:**
- Consumes: `fetchUnreadCount` (Task 10); `MessageThread` (Task 11); the new `sendMessage` signature (Task 10).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

The order page test already exists. Extend `app/panel/pedidos/[id]/page.test.tsx` with a case proving the thread still renders through the shared component:

```tsx
test("renders the order conversation through the shared thread", async () => {
  render(await OrderPage({ params: Promise.resolve({ id: "12" }) }));

  expect(await screen.findByRole("heading", { name: /conversación/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/panel/pedidos/\[id\]/page.test.tsx`
Expected: FAIL — the page still imports the deleted `components/orders/conversation`.

- [ ] **Step 3: Write the implementation**

In both order pages, replace the `Conversation` import with `MessageThread` and update the call site. The conversation id now comes from `order.conversation.id`, and the action is bound with the pair of paths to revalidate:

```tsx
async function messageAction(state: ActionState, formData: FormData) {
  "use server";
  return sendMessage(
    conversationId,
    [`/compras/${order.id}`, `/panel/pedidos/${order.id}`, "/mensajes", "/panel/mensajes"],
    state,
    formData,
  );
}
```

```tsx
<MessageThread
  action={messageAction}
  conversationId={order.conversation.id}
  currentUserId={order.current_user_id}
  messages={order.conversation.messages}
/>
```

In `components/layout/site-header.tsx`, fetch the count for a signed-in viewer and render the link:

```tsx
const unread = signedIn ? await fetchUnreadCount() : 0;
```

```tsx
<Link
  className="relative rounded-full px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-background"
  href="/mensajes"
>
  Mensajes
  {unread > 0 ? (
    <span
      aria-label={`${unread} mensajes sin leer`}
      className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-brand px-1.5 py-0.5 text-xs font-semibold text-white"
    >
      {unread}
    </span>
  ) : null}
</Link>
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npm run lint && npm run typecheck && npm test`
Expected: PASS, with no remaining references to `components/orders/conversation`.

- [ ] **Step 5: Commit**

```bash
git add components/layout/site-header.tsx app/compras app/panel/pedidos
git commit -m "feat: surface unread messages and share one thread everywhere"
```

---

### Task 15: The dispute page reads through the audited path

**Files:**
- Modify: `app/admin/disputas/page.tsx`
- Create: `components/admin/conversation-reveal.tsx`
- Create: `lib/actions/admin-conversation.ts`
- Create: `components/admin/conversation-reveal.test.tsx`

**Interfaces:**
- Consumes: `public.read_conversation_as_admin` (Task 7).
- Produces: `readConversationAsAdmin(conversationId, previousState, formData)`; `<ConversationReveal action conversationId />`.

- [ ] **Step 1: Write the failing test**

Create `components/admin/conversation-reveal.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ConversationReveal } from "@/components/admin/conversation-reveal";

test("asks for a reason before showing anything", () => {
  render(<ConversationReveal action={vi.fn()} conversationId={7} />);

  expect(screen.getByLabelText(/motivo/i)).toBeRequired();
  expect(screen.queryByText(/nunca llegó/i)).not.toBeInTheDocument();
});

test("warns that the read is recorded", () => {
  render(<ConversationReveal action={vi.fn()} conversationId={7} />);

  expect(screen.getByText(/queda registrado/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/admin/conversation-reveal.test.tsx`
Expected: FAIL — cannot resolve `@/components/admin/conversation-reveal`.

- [ ] **Step 3: Write the implementation**

Create `lib/actions/admin-conversation.ts`:

```ts
"use server";

import type { ActionState } from "@/lib/action-state";
import { formValues } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminMessage = {
  id: number;
  sender_id: string;
  sender_label: string;
  body: string;
  created_at: string;
};

export type AdminReadState = ActionState & { messages?: AdminMessage[] };

export async function readConversationAsAdmin(
  conversationId: number,
  _previousState: AdminReadState,
  formData: FormData,
): Promise<AdminReadState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) {
    return { status: "error", message: "Escribe el motivo de la consulta.", values: formValues(formData) };
  }

  if (!isSupabaseConfigured()) return { status: "error", message: "Servicio no configurado." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("read_conversation_as_admin", {
    p_conversation_id: conversationId,
    p_reason: reason,
  });

  if (error) {
    return { status: "error", message: "No pudimos abrir la conversación.", values: formValues(formData) };
  }

  return { status: "success", message: "Consulta registrada.", messages: data ?? [] };
}
```

Create `components/admin/conversation-reveal.tsx`:

```tsx
"use client";

import { useActionState } from "react";

import { formatDate } from "@/lib/format";
import type { AdminReadState } from "@/lib/actions/admin-conversation";

export function ConversationReveal({
  action,
  conversationId,
}: {
  action: (state: AdminReadState, formData: FormData) => Promise<AdminReadState>;
  conversationId: number;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle", message: "" });

  return (
    <div className="mt-5 rounded-2xl border border-line bg-background p-5">
      <form action={formAction} className="space-y-3">
        <label className="block text-sm font-semibold" htmlFor={`reason-${conversationId}`}>
          Motivo de la consulta
        </label>
        <p className="text-sm text-muted">
          Abrir esta conversación queda registrado con tu nombre y el motivo que escribas.
        </p>
        <input
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
          defaultValue={state.values?.reason}
          id={`reason-${conversationId}`}
          maxLength={500}
          minLength={3}
          name="reason"
          required
          type="text"
        />
        <button
          className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white"
          disabled={pending}
          type="submit"
        >
          {pending ? "Abriendo…" : "Abrir conversación"}
        </button>
      </form>

      {state.messages?.length ? (
        <ul className="mt-5 space-y-3">
          {state.messages.map((message) => (
            <li className="rounded-2xl bg-surface p-4" key={message.id}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {message.sender_label} · {formatDate(message.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {state.status === "error" ? (
        <p className="mt-3 text-sm text-sale" role="status">{state.message}</p>
      ) : null}
    </div>
  );
}
```

In `app/admin/disputas/page.tsx`, for each dispute look up the order's conversation id, bind the action, and render `<ConversationReveal />` in place of any direct message rendering.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/admin/conversation-reveal.test.tsx && npm run lint && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin components/admin/conversation-reveal.tsx components/admin/conversation-reveal.test.tsx lib/actions/admin-conversation.ts
git commit -m "feat: make an administrator state why they are opening a conversation"
```

---

### Task 16: End-to-end proof

**Files:**
- Create: `tests/e2e/messaging.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

There are no Playwright specs in this repository yet, so this task builds its
own fixture rather than reusing a helper that does not exist. `playwright.config.ts`
sets `testDir: "./tests/e2e"` and starts `npm run dev` on `http://127.0.0.1:3000`.
`supabase/config.toml` has `enable_confirmations = false`, so an account created
through the sign-up form is signed in immediately with no mailbox step.

- [ ] **Step 1: Write the failing test**

Create `tests/e2e/messaging.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

/** Each run needs its own accounts, because e-mail addresses are unique. */
const stamp = Date.now();
const seller = { email: `seller-${stamp}@test.local`, password: "plaza-volcanes-1", name: "Tienda Prueba" };
const buyer = { email: `buyer-${stamp}@test.local`, password: "plaza-volcanes-1", name: "Ana Ruiz" };

async function register(page: Page, account: { email: string; password: string; name: string }) {
  await page.goto("/registro");
  await page.getByLabel(/tu nombre/i).fill(account.name);
  await page.getByLabel(/correo/i).fill(account.email);
  await page.getByLabel(/contraseña/i).fill(account.password);
  await page.getByLabel(/teléfono/i).fill("3312345678");
  await page.getByRole("button", { name: /crear cuenta|registrarme/i }).click();
  await expect(page).not.toHaveURL(/registro/);
}

test("a shopper asks a question and the shop answers", async ({ browser }) => {
  const sellerContext = await browser.newContext();
  const buyerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  const buyerPage = await buyerContext.newPage();

  await register(sellerPage, seller);

  // The shop the buyer will write to.
  await sellerPage.goto("/panel/tiendas/nueva");
  await sellerPage.getByLabel(/nombre/i).first().fill(`Tienda ${stamp}`);
  await sellerPage.getByRole("button", { name: /crear|guardar|publicar/i }).click();
  await expect(sellerPage).toHaveURL(/\/panel\/tiendas\//);

  const shopUrl = new URL(sellerPage.url());

  await register(buyerPage, buyer);

  // The buyer opens the shop and starts a conversation.
  await buyerPage.goto(shopUrl.pathname.replace("/panel/tiendas", "/tiendas"));
  await buyerPage.getByRole("button", { name: /mensaje a la tienda/i }).click();
  await expect(buyerPage).toHaveURL(/\/mensajes\/\d+/);

  await buyerPage.getByLabel("Mensaje").fill("¿Tienes talla 8?");
  await buyerPage.getByRole("button", { name: /enviar mensaje/i }).click();
  await expect(buyerPage.getByText("¿Tienes talla 8?")).toBeVisible();

  // The seller sees it waiting, by the buyer's chosen name.
  await sellerPage.goto("/panel/mensajes");
  await expect(sellerPage.getByLabel(/mensajes sin leer/i)).toBeVisible();
  await sellerPage.getByRole("link", { name: new RegExp(buyer.name, "i") }).click();

  await sellerPage.getByLabel("Mensaje").fill("Sí, tenemos");
  await sellerPage.getByRole("button", { name: /enviar mensaje/i }).click();

  // The buyer's thread is still open, so the answer arrives without a reload.
  await expect(buyerPage.getByText("Sí, tenemos")).toBeVisible({ timeout: 15_000 });

  // Opening the thread cleared the badge.
  await sellerPage.reload();
  await expect(sellerPage.getByLabel(/mensajes sin leer/i)).toBeHidden();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `supabase start && npx playwright test tests/e2e/messaging.spec.ts`
Expected: FAIL. Run it before Task 13 is merged and it fails at the "Mensaje a la tienda" button; run it after everything and it should pass.

- [ ] **Step 3: Reconcile the selectors with the real forms**

The sign-up and shop forms were written before this plan, so their labels and
button text may not match the guesses above. Open `/registro` and
`/panel/tiendas/nueva` in a browser, read the actual labels, and correct the
selectors — do not change what the test asserts. In particular:

- If the shop form has required fields beyond a name, fill them.
- If the sign-up button reads something other than the two alternatives above,
  use its real text.

Do not weaken the two assertions that matter: the answer arriving without a
reload proves live delivery from Task 11, and the badge clearing proves the read
tracking from Tasks 3 and 14. If either fails, that is a real defect, not a test
to relax.

- [ ] **Step 4: Run the whole suite**

Run: `npm run lint && npm run typecheck && npm test && supabase test db supabase/tests/database && npx playwright test`
Expected: PASS everywhere.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/messaging.spec.ts
git commit -m "test: prove a question reaches a shop and the answer comes back live"
```

---

## Finding from Task 16

**Realtime needs the session handed to it explicitly.** The browser client opens
its socket with only the publishable key. Realtime authorizes each subscriber
against the row-level policy on `public.messages`, and that policy grants the
`authenticated` role, so a socket without a user JWT subscribes as `anon` and is
delivered nothing — while still reporting `SUBSCRIBED`, which is what makes it
easy to miss. Before subscribing:

```ts
const { data } = await supabase.auth.getSession();
supabase.realtime.setAuth(data.session?.access_token ?? null);
```

No unit test catches this, because a mocked channel delivers whatever the test
hands it. Only the end-to-end run does.

**Run Playwright against the local stack.** `.env.local` in this repository
points at the linked remote project. Next leaves variables already present in
the environment alone, so pass the local URL and publishable key from
`supabase status` on the command line. Running against the remote project would
create real accounts.

**pgTAP assumes a clean database.** The tests insert fixed ids, so a Playwright
run leaves rows that make three of them fail. Run `supabase db reset` before
`supabase test db` if the app has been exercised in between.
