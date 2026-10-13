# Admin Disable and Delete Users — Design Specification

## Objective

Let administrators disable, re-enable, and delete marketplace accounts from `/admin/usuarios`.

## Scope

This project includes:

- A `public.set_user_disabled(uuid, boolean)` RPC that bans or unbans an account
- A `public.admin_delete_user(uuid)` RPC that permanently deletes an account with no commerce history
- Two new columns on `public.list_admin_marketplace_users()`: `user_is_disabled` and `user_is_admin`
- Administrator storage policies that let the delete flow remove the deleted account's catalog images
- Account controls on each user card in `/admin/usuarios`
- Database, action, mapper, and component tests

This project excludes:

- A separate super-administrator role. `private.admin_users` remains the only administrator membership, as decided in `2026-08-28-super-admin-marketplace-view-design.md`; every administrator receives these powers.
- A service-role key in the application. Both mutations are `security definer` RPCs, matching every other administrator mutation.
- Anonymizing or purging accounts that have orders, conversations, messages, reviews, or disputes. Those accounts can only be disabled.
- Revoking an already-issued access token. See "Disable" for the resulting window.
- Managing administrator membership.
- A reason field, bulk actions, or notification emails to the affected person.

## Guards

Both RPCs enforce the same rules at the database boundary, in this order:

1. The caller is signed in and is an administrator, otherwise SQLSTATE `42501`.
2. The target is not the caller, otherwise `22023`.
3. The target is not an administrator, otherwise `22023`. Removing an administrator stays a deliberate database-operator action.
4. The target exists in `auth.users`, otherwise `P0002`.

The interface hides the controls for administrator accounts, which includes the viewer's own. That is a convenience; the database rules above are the authorization.

## Disable

`public.set_user_disabled(p_user_id uuid, p_disabled boolean)` returns one row: `user_id uuid, is_disabled boolean, shop_slugs text[], product_slugs text[]`.

Disabling:

- Sets `auth.users.banned_until` to `now() + interval '100 years'`. This is Supabase Auth's own ban field, so sign-in and token refresh are refused by the auth server with no application check. A finite far-future timestamp is used instead of `infinity` because the auth server parses the column into a native time value.
- Deletes the account's `auth.sessions` rows, which cascades to its refresh tokens.
- Withdraws publishing approval from every approved shop the account owns by calling the existing `public.set_shop_publishing_approval(shop_id, false)`. This reuses the one code path that hides listings and clears their expiry windows without touching the seller's own draft or published decisions.

Enabling sets `banned_until` to `null` and nothing else. Shops stay pending: an administrator re-approves each one with the existing switch. Restoring approvals automatically would re-publish listings without anyone looking at them.

An account is disabled when `banned_until is not null and banned_until > now()`. No new table records the state; the audit trail records who changed it and when.

The returned slugs name the shops whose approval was withdrawn and their published products, so the server action can revalidate the public pages that just lost them. Enabling returns empty arrays.

An access token issued before the ban stays valid until it expires, at most one hour with the configured `jwt_expiry`. Deleting the sessions means it cannot be refreshed. Closing that window would need a disabled check in every RLS policy and is out of scope.

Calling the RPC with the state the account already has is not an error. Disabling again still deletes sessions and withdraws any approval granted since. An audit event is written only when the state actually changes.

## Delete

`public.admin_delete_user(p_user_id uuid)` returns one row: `user_id uuid, shop_slugs text[], product_slugs text[], image_keys text[]`.

After the guards it collects the account's shop slugs, published product slugs, and every catalog object key (shop pictures, product covers, gallery images), then runs `delete from auth.users where id = p_user_id`. Existing `on delete cascade` foreign keys remove shops, products, galleries, contact details, display name, trust profile, and notification settings.

`on delete restrict` foreign keys protect records that belong to someone else's history as well: orders, conversations, messages, reviews, disputes, and buyer or seller activity events, whether the account is the buyer or owns the shop involved. When any exist the delete fails; the RPC catches the foreign-key violation and raises SQLSTATE `23503` with the message `Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla.` Nothing is changed.

Catalog images live in the public `catalogo` bucket and are not removed by the database cascade. The server action removes the returned keys through the existing `deleteObjects` media helper after the RPC succeeds. Administrators receive `select` and `delete` policies on `storage.objects` for that bucket so the removal is authorized. Image removal is best effort, as it already is for shop and product deletion.

## Audit

`private.admin_audit_events.action` gains `user_disabled`, `user_enabled`, and `user_deleted`.

- `user_disabled` and `user_enabled` set `actor_id` and `target_user_id`. `user_disabled` records the affected `shop_ids` in `metadata`.
- `user_deleted` sets `actor_id` and leaves `target_user_id` null, because the row is written after the account is gone. `metadata` keeps `user_id`, `email`, and `shop_count` so the event still identifies what was deleted.

## Read Model

`public.list_admin_marketplace_users()` adds two columns after `shop_limit`:

- `user_is_disabled boolean` — the ban predicate above
- `user_is_admin boolean` — membership in `private.admin_users`

`AdminMarketplaceRpcRow`, `AdminMarketplaceUser` (`isDisabled`, `isAdmin`), the mapper, and the hand-maintained `Database` type follow.

## Server Actions

`lib/actions/admin-users.ts` exports `setUserDisabled` and `deleteUser`, both `(previousState, formData) => Promise<ActionState>` and both following `lib/actions/admin-publication.ts`: validate the form, require a claim subject, require `is_current_user_admin`, call the RPC, revalidate, and never echo a database error message.

Messages:

| Case | `setUserDisabled` | `deleteUser` |
| --- | --- | --- |
| Malformed input | `Datos de cuenta inválidos.` | same |
| No session | `Tu sesión terminó. Ingresa nuevamente.` | same |
| Not an administrator | `No tienes permiso para administrar cuentas.` | same |
| `22023` | `No puedes deshabilitar tu propia cuenta ni la de otra persona administradora.` | `No puedes eliminar tu propia cuenta ni la de otra persona administradora.` |
| `23503` | — | `Esta cuenta tiene historial de pedidos o conversaciones. Deshabilítala en lugar de eliminarla.` |
| Other failure | `No pudimos actualizar la cuenta.` | `No pudimos eliminar la cuenta.` |
| Success | `Cuenta deshabilitada.` / `Cuenta habilitada.` | `Cuenta eliminada.` |

Both revalidate `/`, `/admin/usuarios`, `/sitemap.xml`, and each returned `/tiendas/{slug}` and `/productos/{slug}`.

## Interface

`components/admin/user-account-controls.tsx` is a client component rendered in each user card by `MarketplaceUsers`.

- A disabled account shows a `Cuenta deshabilitada` badge beside its name.
- An administrator account shows `Cuenta de administración` and no controls.
- Otherwise the card shows `Deshabilitar cuenta` or `Habilitar cuenta`, and `Eliminar cuenta`.
- `Eliminar cuenta` does not submit. It reveals an inline confirmation that states the deletion is permanent and asks the administrator to type the account's email (or `ELIMINAR` when the account has no email). `Eliminar definitivamente` stays disabled until the text matches; `Cancelar` closes the confirmation. No browser dialog is used.
- Action messages render in a `role="status"` line, as the existing admin forms do.

## Sign-in

The sign-in action maps the auth server's `user_banned` error to `Tu cuenta fue deshabilitada por administración.` instead of the wrong-credentials message. The auth server returns that code whatever password was sent, to anyone calling it with the public key, so the application message discloses nothing new.

## Testing

### Database (`supabase/tests/database/admin_user_accounts.test.sql`)

- Both RPCs exist; the list RPC exposes the two new columns
- A non-administrator is refused with `42501` by both
- Self and administrator targets are refused with `22023`; an unknown id with `P0002`
- Disabling sets a future `banned_until`, deletes sessions, withdraws shop approval, clears listing expiry, returns the slugs, and writes `user_disabled`
- Enabling clears the ban, leaves shops pending, and writes `user_enabled`
- Repeating a state writes no second audit event
- Deleting a history-free account removes it with its shops and published listings, returns image keys, and writes `user_deleted` with the email snapshot
- Deleting an account with an order as buyer, or whose shop has an order, fails with `23503` and leaves the account in place
- The list RPC reports `user_is_disabled` and `user_is_admin`

### Unit and component (Vitest)

- Mapper carries `isDisabled` and `isAdmin`
- Sign-in maps `user_banned` to the disabled-account message
- Each action: malformed input short-circuits, missing claim, non-administrator, exact RPC arguments, coded errors map to their messages without leaking database text, success revalidates the listed paths, and `deleteUser` hands returned keys to the media store
- Controls: badge, administrator accounts have no controls, toggle submits the opposite state, delete requires the typed email before it can submit, cancel closes the confirmation

### End to end (`tests/e2e/admin-user-accounts.spec.ts`)

Against the local stack and through the real interface: an administrator sees no actions on administrator accounts, disables an account, the disabled person is told why sign-in is refused, the administrator re-enables it and the person signs in, and the administrator deletes it after typing its email.

### Verification gates

Focused Vitest files, `supabase test db`, `npm run typecheck`, `npm run lint`, full `npm test`, and the end-to-end spec.
