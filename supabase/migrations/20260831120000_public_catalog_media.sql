-- Catalog media returns to a public bucket, addressed by NEXT_PUBLIC_MEDIA_BASE.
--
-- A published listing's photo is already public information: the listing page
-- shows it to anyone. Signing those reads bought no privacy and cost a Storage
-- round trip on every catalogue render plus any chance of CDN caching. Draft
-- photos keep unguessable UUID keys and are rendered only inside their owner's
-- panel, which is the protection this project accepts for them.
--
-- This reverses 20260831014608_private_catalog_image_access.sql.

update storage.buckets
set public = true
where id = 'catalogo';

drop policy if exists "visible_shop_images_are_signable" on storage.objects;
drop policy if exists "visible_product_images_are_signable" on storage.objects;

drop policy if exists "catalog_images_are_publicly_readable" on storage.objects;
create policy "catalog_images_are_publicly_readable"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'catalogo'
    and storage.allow_any_operation(
      array['object.get_authenticated_info', 'object.get_authenticated']
    )
  );

-- Keys moved from `{uid}/products/{uuid}.ext` to
-- `products/{uid}/{productId}/{uuid}.ext`, so ownership is the first folder on
-- an old key and the second on a new one. Both are accepted while objects
-- written before this migration are still in the bucket.
create or replace function private.owns_catalog_object(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (storage.foldername(object_name))[1] = (select auth.uid())::text
    or (
      (storage.foldername(object_name))[1] in ('products', 'shops')
      and (storage.foldername(object_name))[2] = (select auth.uid())::text
    );
$$;

revoke execute on function private.owns_catalog_object(text) from public;
grant execute on function private.owns_catalog_object(text) to authenticated;

drop policy if exists "owners_upload_catalog_images" on storage.objects;
create policy "owners_upload_catalog_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalogo'
    and private.owns_catalog_object(name)
  );

drop policy if exists "owners_update_catalog_images" on storage.objects;
create policy "owners_update_catalog_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalogo'
    and owner_id = (select auth.uid())::text
    and private.owns_catalog_object(name)
  )
  with check (
    bucket_id = 'catalogo'
    and owner_id = (select auth.uid())::text
    and private.owns_catalog_object(name)
  );

drop policy if exists "owners_delete_catalog_images" on storage.objects;
create policy "owners_delete_catalog_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalogo'
    and owner_id = (select auth.uid())::text
    and private.owns_catalog_object(name)
  );

-- Rollback:
--   re-run 20260831014608_private_catalog_image_access.sql, then restore the
--   three owner policies above with `(storage.foldername(name))[1] = auth.uid()`
--   and drop private.owns_catalog_object(text). Note that objects written under
--   the new key layout stop being writable by their owners if you do.
