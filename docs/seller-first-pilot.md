# Seller-first pilot handoff

## Launch gate

The assisted-publishing link stays hidden until `ASSISTED_ONBOARDING_CONTACT_READY=true` is set on the server. Before setting it, founder must sign in as an administrator, open `/admin/contacto`, confirm new messages arrive from `/quejas-y-aclaraciones#escribenos`, and arrange daily monitoring and replies. The existing contact form stores messages in `private.contact_messages`; no new contact destination or CRM was added. Keep the flag unset if that queue is not monitored.

Set `NEXT_PUBLIC_SITE_URL` to the canonical public origin before launch. Seller sharing uses that value to build `/tiendas/[slug]` links. Configure PostHog only after the privacy notice and consent flow are ready, as described in `docs/posthog-analytics.md`.

## Pilot measures

Targets: **10 seller conversations, 5 shops with live inventory, 3 owners who share with customers.** Log conversations and confirmed sends manually. A WhatsApp click, native share attempt, or copy click proves intent only. Count actual customer opens separately from `$pageview` on `/tiendas/[slug]`; a pageview does not identify the sender and includes seller/self visits.

Use existing PostHog events:

| Stage | Source | Meaning |
| --- | --- | --- |
| Signup intent | `seller_signup_submitted` | Form attempt; may fail validation or email confirmation. |
| Shop created | `public.shops.created_at` | Saved shop, unique by `id`; account signup itself is not inferred. |
| First live inventory | Current `public.products` joined to approved shop | Unique shop with at least one currently public product; historical first-publish timestamp is not stored. |
| Share/copy intent | `seller_storefront_share_intent`, distinct `shop_id` | Method is `native`, `whatsapp`, or `copy`. Repeated actions on later days remain visible by shop and event day. |
| Opened storefront | `$pageview` path `/tiendas/[slug]` | Actual page visit, separate from share intent; not unique buyers. |

Use this read-only SQL in an administrator database console for current live inventory and later inventory edits. It returns only shop IDs, slugs, counts and dates:

```sql
select s.id as shop_id, s.slug, s.created_at::date as shop_created_day,
       count(p.id) filter (where p.status = 'published'
         and p.is_admin_enabled and p.expires_at > now()) as live_products,
       max(p.updated_at)::date as last_inventory_edit_day
from public.shops s
left join public.products p on p.shop_id = s.id
where s.is_publishing_approved
group by s.id, s.slug, s.created_at
order by s.created_at;
```

Filter `live_products > 0` for active shops. Compare `last_inventory_edit_day` with `shop_created_day` to review later inventory activity; the timestamp can include moderation or automatic updates, so inspect product records before attributing an edit to an owner. In PostHog, group `seller_storefront_share_intent` by `shop_id` and local event date to find shops with another share/copy attempt on a later day. Never send message text, contact details, or form values to analytics.

## Flow checks

Use local Supabase test stack for a full seller and signed-out buyer run. Approve test shop for publication, publish one product with photo and MXN price, then check panel share card and copy fallback. Open copied URL in a fresh mobile browser context, check shop name, photo, price and product link. On product, tap `Preguntar por este producto`, sign in or register as buyer, confirm return to that product at `#preguntar`, then open conversation. No question field exists before sign-in, so no typed text can be lost in that step. Check empty shop URL and empty home catalog separately. Capture mobile and desktop screenshots. Do not run fixture creation against a production Supabase project.
