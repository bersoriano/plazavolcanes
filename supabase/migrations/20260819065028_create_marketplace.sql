create table public.shops (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 20 and 1200),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  shop_id bigint not null references public.shops (id) on delete cascade,
  name text not null check (char_length(name) between 3 and 120),
  description text not null check (char_length(description) between 20 and 3000),
  price_mxn numeric(12, 2) not null check (price_mxn >= 0),
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shops_owner_id_idx on public.shops (owner_id);
create index products_shop_id_idx on public.products (shop_id);
create index products_published_created_at_idx
  on public.products (created_at desc)
  where status = 'published';

grant usage on schema public to anon, authenticated;
grant select on table public.shops, public.products to anon;
grant select, insert, update, delete on table public.shops, public.products to authenticated;
grant usage, select on sequence public.shops_id_seq, public.products_id_seq to authenticated;

alter table public.shops enable row level security;
alter table public.products enable row level security;

create policy "shops_are_public"
  on public.shops for select
  to anon, authenticated
  using (true);

create policy "owners_create_shops"
  on public.shops for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "owners_update_shops"
  on public.shops for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "owners_delete_shops"
  on public.shops for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "published_products_and_owner_drafts_are_visible"
  on public.products for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (
      select 1
      from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_create_products"
  on public.products for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_update_products"
  on public.products for update
  to authenticated
  using (
    exists (
      select 1
      from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_delete_products"
  on public.products for delete
  to authenticated
  using (
    exists (
      select 1
      from public.shops
      where shops.id = products.shop_id
        and shops.owner_id = (select auth.uid())
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'catalogo',
  'catalogo',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "catalog_images_are_publicly_readable"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'catalogo'
    and storage.allow_any_operation(
      array['object.get_authenticated_info', 'object.get_authenticated']
    )
  );

create policy "owners_upload_catalog_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'catalogo'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners_update_catalog_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'catalogo'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'catalogo'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "owners_delete_catalog_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'catalogo'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
