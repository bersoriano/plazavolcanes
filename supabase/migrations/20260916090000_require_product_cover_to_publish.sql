-- New publication transitions require a derived gallery cover. Existing published
-- rows remain writable so historic listings without a migrated cover are not
-- broken; they simply cannot be republished after being taken down.
create or replace function private.enforce_product_cover_on_publish()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published')
    and new.image_path is null then
    raise exception using
      errcode = 'P0001',
      message = 'Agrega una imagen de portada antes de publicar.';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_product_cover_on_publish() from public, anon, authenticated;

drop trigger if exists enforce_product_cover_on_publish on public.products;
create trigger enforce_product_cover_on_publish
before insert or update of status on public.products
for each row
execute function private.enforce_product_cover_on_publish();

-- A public listing must always retain a cover. Locking its parent serializes
-- competing deletes, so two requests cannot each observe a different last row.
create or replace function private.prevent_final_published_product_image_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.products
  where id = old.product_id
  for update;

  if v_status = 'published' and not exists (
    select 1
    from public.product_images
    where product_id = old.product_id
      and id <> old.id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Una publicación debe conservar una imagen de portada.';
  end if;

  return old;
end;
$$;

revoke execute on function private.prevent_final_published_product_image_delete() from public, anon, authenticated;

drop trigger if exists prevent_final_published_product_image_delete on public.product_images;
create trigger prevent_final_published_product_image_delete
before delete on public.product_images
for each row
execute function private.prevent_final_published_product_image_delete();

-- Rollback:
-- drop trigger prevent_final_published_product_image_delete on public.product_images;
-- drop function private.prevent_final_published_product_image_delete();
-- drop trigger enforce_product_cover_on_publish on public.products;
-- drop function private.enforce_product_cover_on_publish();
