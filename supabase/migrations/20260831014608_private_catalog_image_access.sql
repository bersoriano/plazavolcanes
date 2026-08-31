-- Product media now follows product RLS instead of remaining permanently public.
-- Existing object paths stay unchanged; only read authorization changes.

update storage.buckets
set public = false
where id = 'catalogo';

drop policy if exists "catalog_images_are_publicly_readable" on storage.objects;

drop policy if exists "admins_read_all_products" on public.products;
create policy "admins_read_all_products"
  on public.products for select
  to authenticated
  using ((select public.is_current_user_admin()));

drop policy if exists "admins_read_all_product_images" on public.product_images;
create policy "admins_read_all_product_images"
  on public.product_images for select
  to authenticated
  using ((select public.is_current_user_admin()));

drop policy if exists "visible_shop_images_are_signable" on storage.objects;
create policy "visible_shop_images_are_signable"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'catalogo'
    and storage.allow_any_operation(
      array[
        'object.get_authenticated_info',
        'object.get_authenticated',
        'object.sign_many'
      ]
    )
    and exists (
      select 1
      from public.shops s
      where s.image_path = storage.objects.name
    )
  );

drop policy if exists "visible_product_images_are_signable" on storage.objects;
create policy "visible_product_images_are_signable"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'catalogo'
    and storage.allow_any_operation(
      array[
        'object.get_authenticated_info',
        'object.get_authenticated',
        'object.sign_many'
      ]
    )
    and exists (
      select 1
      from public.product_images pi
      where pi.storage_path = storage.objects.name
    )
  );

-- Rollback:
--   update storage.buckets set public = true where id = 'catalogo';
--   drop policies visible_shop_images_are_signable and
--     visible_product_images_are_signable from storage.objects;
--   drop policies admins_read_all_products and
--     admins_read_all_product_images from their public tables;
--   recreate catalog_images_are_publicly_readable using original policy from
--     20260819065028_create_marketplace.sql.
