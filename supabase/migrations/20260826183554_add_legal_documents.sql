-- Legal documents are contracts and statutory notices. A published version is
-- evidence of what a person agreed to, so it is immutable at the table.
-- Application roles (anon, authenticated, service_role) hold no INSERT,
-- UPDATE or DELETE grant on either table -- that is the real boundary --
-- so the only way any of them can change a status is through the
-- admin-gated, security-definer publish_legal_version(), which runs as the
-- table owner and records who approved the change. The guard trigger below
-- is defense-in-depth on top of that grant boundary, not the boundary
-- itself: a superuser, the table owner, or a migration run as the owner can
-- still write around both layers, same as everywhere else in this schema.
-- Drafts are invisible to every non-admin reader, which is what keeps
-- unreviewed text from ever reaching a buyer.

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

-- Nobody -- not anon, not authenticated, not service_role -- holds a write
-- grant on either table. service_role bypasses RLS but not GRANTs, and it is
-- a member of no other role, so it cannot become the table owner either.
-- publish_legal_version() is security definer and owned by postgres (the
-- table owner), so it keeps write access after every application role loses
-- it. This is what actually stops a forged publish, not the trigger below.
revoke all on table public.legal_documents, public.legal_document_versions
  from public, anon, authenticated, service_role;
grant select on table public.legal_documents, public.legal_document_versions
  to anon, authenticated, service_role;

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

-- Defense-in-depth on top of the grants above, not the boundary itself: even
-- with every write grant removed from application roles, this still blocks
-- a bare INSERT of a 'published' or 'retired' row, an UPDATE that flips
-- draft/approved straight to either status, and any edit or deletion of a
-- non-draft row. publish_legal_version() is the only code that legitimately
-- moves a row to 'published' (and, for the row it supersedes, to 'retired'
-- immediately after) -- and it does so running as the table owner, since it
-- is security definer and owned by postgres. So those two specific
-- transitions are allowed only when current_user is the table's owner,
-- proving the write came from that function and not from a caller merely
-- holding a grant the function itself relies on. A direct draft/approved ->
-- 'retired' jump has no publish behind it at all (no predecessor being
-- superseded), so it is rejected outright, with no such exception.
create function private.guard_published_legal_versions()
returns trigger
language plpgsql
as $$
declare
  v_is_table_owner boolean;
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501',
      message = 'Una versión legal no se elimina.';
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('published', 'retired') then
      raise exception using errcode = '42501',
        message = 'Una versión legal solo se publica mediante la función autorizada.';
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE' from here on.
  v_is_table_owner := current_user = (
    select pg_get_userbyid(relowner) from pg_class where oid = tg_relid
  );

  if old.status = 'retired' then
    raise exception using errcode = '42501',
      message = 'Una versión retirada es inmutable.';
  end if;

  if old.status = 'published' then
    -- The single permitted transition: retiring a version when its successor
    -- publishes. Comparing the whole row (less the two columns that
    -- legitimately change) is both shorter than a column allowlist and closed
    -- against columns a later migration adds -- an allowlist would silently
    -- let a new column through untested.
    if new.status = 'retired'
      and new.retired_at is not null
      and v_is_table_owner
      and (to_jsonb(new) - 'status' - 'retired_at') = (to_jsonb(old) - 'status' - 'retired_at')
    then
      return new;
    end if;

    raise exception using errcode = '42501',
      message = 'Una versión publicada es inmutable.';
  end if;

  -- old.status is 'draft' or 'approved' here. The only transition
  -- publish_legal_version() performs from this state is to 'published', and
  -- only as the table owner. A direct jump to 'retired' is never legitimate
  -- from here -- there is no predecessor being superseded -- so it gets no
  -- owner exception at all.
  if new.status = 'retired' then
    raise exception using errcode = '42501',
      message = 'Una versión legal solo se publica mediante la función autorizada.';
  end if;

  if new.status = 'published' and not v_is_table_owner then
    raise exception using errcode = '42501',
      message = 'Una versión legal solo se publica mediante la función autorizada.';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_published_legal_versions()
  from public, anon, authenticated;

create trigger guard_published_legal_versions
  before insert or update or delete on public.legal_document_versions
  for each row execute function private.guard_published_legal_versions();

-- Publishing records an existing audit action vocabulary, so widen it. The
-- prior migration's constraint name is not something this migration can
-- assume: guessing wrong would make the drop a silent no-op, leaving the old
-- constraint in place alongside the new one and failing every publish at
-- runtime with a violation that looks like a code bug. Instead, discover
-- whichever check constraint on this table currently mentions
-- 'dispute_resolved' and drop that one by its real name.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'private.admin_audit_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%dispute_resolved%';

  if v_constraint_name is null then
    raise exception 'No se encontró la restricción de acción en private.admin_audit_events.';
  end if;

  execute format(
    'alter table private.admin_audit_events drop constraint %I',
    v_constraint_name
  );
end;
$$;

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
