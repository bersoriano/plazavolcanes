alter table public.products
  add column condition text not null default 'new',
  add column used_condition text;

alter table public.products
  add constraint products_condition_check
    check (condition in ('new', 'used')) not valid,
  add constraint products_used_condition_check
    check (
      used_condition is null
      or used_condition in ('mint', 'good', 'fair', 'bad', 'scrap')
    ) not valid,
  add constraint products_condition_consistency_check
    check (
      (condition = 'new' and used_condition is null)
      or (condition = 'used' and used_condition is not null)
    ) not valid;

alter table public.products
  validate constraint products_condition_check,
  validate constraint products_used_condition_check,
  validate constraint products_condition_consistency_check;

-- Destructive rollback, only if explicitly required:
-- alter table public.products
--   drop constraint products_condition_consistency_check,
--   drop constraint products_used_condition_check,
--   drop constraint products_condition_check,
--   drop column used_condition,
--   drop column condition;
