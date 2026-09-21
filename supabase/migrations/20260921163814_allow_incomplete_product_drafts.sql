-- A seller can save work in progress without pretending details are known.
-- Publication remains gated in the authenticated server action; drafts are private.
alter table public.products
  alter column description drop not null,
  alter column price_mxn drop not null,
  alter column condition drop not null,
  alter column handling_days drop not null,
  alter column units_available drop not null;

-- Rollback only after resolving every incomplete draft:
-- alter table public.products alter column description set not null;
-- alter table public.products alter column price_mxn set not null;
-- alter table public.products alter column condition set not null;
-- alter table public.products alter column handling_days set not null;
-- alter table public.products alter column units_available set not null;
