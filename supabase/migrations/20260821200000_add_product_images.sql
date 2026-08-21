-- A listing may carry up to five images. Position 0 is the cover, and products.image_path
-- is kept in sync with it so every existing reader (cards, search, order snapshots)
-- keeps working without knowing this table exists.
create table if not exists public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique (product_id, position)
);

create index if not exists product_images_product_position_idx
  on public.product_images (product_id, position);

grant select on table public.product_images to anon, authenticated;
grant insert, update, delete on table public.product_images to authenticated;
grant usage, select on sequence public.product_images_id_seq to authenticated;

alter table public.product_images enable row level security;

-- Visibility mirrors the product: public once published, owner-only while a draft.
create policy "product_images_follow_product_visibility"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_images.product_id
        and (products.status = 'published' or shops.owner_id = (select auth.uid()))
    )
  );

create policy "owners_write_product_images"
  on public.product_images for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_images.product_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_update_product_images"
  on public.product_images for update
  to authenticated
  using (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_images.product_id
        and shops.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_images.product_id
        and shops.owner_id = (select auth.uid())
    )
  );

create policy "owners_delete_product_images"
  on public.product_images for delete
  to authenticated
  using (
    exists (
      select 1
      from public.products
      join public.shops on shops.id = products.shop_id
      where products.id = product_images.product_id
        and shops.owner_id = (select auth.uid())
    )
  );

-- The cover is derived, never hand-maintained: whatever sits at the lowest position wins.
create or replace function private.sync_product_cover_image()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id bigint := coalesce(new.product_id, old.product_id);
  v_cover text;
begin
  select storage_path into v_cover
  from public.product_images
  where product_id = v_product_id
  order by position, id
  limit 1;

  update public.products
    set image_path = v_cover, updated_at = now()
    where id = v_product_id and image_path is distinct from v_cover;

  return null;
end;
$$;

revoke execute on function private.sync_product_cover_image() from public, anon, authenticated;

create trigger product_images_sync_cover
  after insert or update or delete on public.product_images
  for each row
  execute function private.sync_product_cover_image();

-- Existing single images become the cover of their product's new gallery.
insert into public.product_images (product_id, storage_path, position)
select id, image_path, 0
from public.products
where image_path is not null
on conflict (product_id, position) do nothing;

-- Rollback:
-- drop trigger product_images_sync_cover on public.product_images;
-- drop function private.sync_product_cover_image();
-- drop table public.product_images;
