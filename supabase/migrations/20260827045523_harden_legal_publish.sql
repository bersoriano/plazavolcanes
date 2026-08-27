-- public.publish_legal_version() previously accepted any non-empty jsonb as
-- the issuer identity (e.g. '{"rfc":"X"}') and never inspected the document
-- body at all. LFPC art. 32 requires published information to be veraz,
-- comprobable y clara; a published version whose identity is a single
-- fragment, or whose body is missing sections that readSections()
-- (lib/queries/legal.server.ts) would silently drop, would still carry a
-- content_hash that attests to "the body it was published with" while a
-- reader sees fewer clauses than counsel approved. This migration replaces
-- the function with a version that validates both shapes before publishing.
-- Everything else -- the admin check, security definer, search_path, the
-- revokes/grants, the supersession and the audit event -- is unchanged.

-- If pgcrypto already existed in some other schema before the prior
-- migration ran, `create extension if not exists pgcrypto with schema
-- extensions` is a silent no-op and extensions.digest never resolves. That
-- would otherwise surface for the first time inside publish_legal_version(),
-- at publish time, long after this migration appeared to succeed. Fail here
-- instead, while the mistake is still attributable to this migration.
do $$
begin
  perform extensions.digest('legal-publish-migration-probe', 'sha256');
exception
  when undefined_function or invalid_schema_name then
    raise exception
      'extensions.digest no está disponible: pgcrypto no está instalado en el esquema "extensions".';
end;
$$;

create or replace function public.publish_legal_version(p_version_id uuid, p_issuer_identity jsonb)
returns public.legal_document_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.legal_document_versions;
  v_current uuid;
  v_required_identity_keys constant text[] := array[
    'entityName', 'rfc', 'address', 'email', 'phone', 'attentionHours', 'privacyContact'
  ];
  v_key text;
  v_missing_keys text[] := '{}';
  v_section jsonb;
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

  if p_issuer_identity is null or jsonb_typeof(p_issuer_identity) <> 'object' then
    raise exception using errcode = '22023',
      message = 'Falta la identidad del responsable.';
  end if;

  -- Every key must be present as a non-empty string. A key that exists but
  -- holds an empty string, a number, or is simply absent all count as
  -- missing: the reader needs the fact, not a technicality about how it was
  -- absent.
  foreach v_key in array v_required_identity_keys loop
    if not (p_issuer_identity ? v_key)
      or jsonb_typeof(p_issuer_identity -> v_key) <> 'string'
      or btrim(p_issuer_identity ->> v_key) = ''
    then
      v_missing_keys := array_append(v_missing_keys, v_key);
    end if;
  end loop;

  if array_length(v_missing_keys, 1) > 0 then
    raise exception using errcode = '22023',
      message = format(
        'Falta la identidad del responsable: %s.',
        array_to_string(v_missing_keys, ', ')
      );
  end if;

  -- The body must be shaped {"sections": [...]}. readSections() in
  -- lib/queries/legal.server.ts silently drops any section it cannot parse,
  -- so a body that is malformed here would otherwise publish successfully
  -- and render with clauses missing while content_hash still attests to it.
  -- `is distinct from` (not `<>`) matters here: when "sections" is absent
  -- entirely, `v_row.body -> 'sections'` is SQL NULL, and
  -- `jsonb_typeof(NULL) <> 'array'` evaluates to NULL under normal
  -- three-valued logic -- which does not satisfy an IF condition, so the
  -- missing-key case would silently pass. `is distinct from` always returns
  -- a real boolean.
  if jsonb_typeof(v_row.body) <> 'object'
    or jsonb_typeof(v_row.body -> 'sections') is distinct from 'array'
  then
    raise exception using errcode = '22023',
      message = 'El cuerpo del documento debe tener la forma {"sections": [...]}.';
  end if;

  -- Same `is distinct from` reasoning as above: "heading" or "paragraphs"
  -- being entirely absent from a section must not evaluate to NULL and slip
  -- past this check.
  for v_section in select * from jsonb_array_elements(v_row.body -> 'sections') loop
    if jsonb_typeof(v_section) <> 'object'
      or jsonb_typeof(v_section -> 'id') is distinct from 'string'
      or btrim(v_section ->> 'id') = ''
      or jsonb_typeof(v_section -> 'heading') is distinct from 'string'
      or btrim(v_section ->> 'heading') = ''
      or jsonb_typeof(v_section -> 'paragraphs') is distinct from 'array'
    then
      raise exception using errcode = '22023',
        message = 'Cada sección del cuerpo debe tener "id" y "heading" (texto no vacío) y "paragraphs" (arreglo).';
    end if;
  end loop;

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

-- Rollback:
-- The prior definition (accepting any non-empty jsonb identity and any body)
-- would need to be restored verbatim from
-- supabase/migrations/20260826183554_add_legal_documents.sql to fully revert;
-- at minimum, drop this migration's added validation by re-running that
-- earlier CREATE FUNCTION public.publish_legal_version(uuid, jsonb) statement.
