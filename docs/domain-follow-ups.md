# Domain move: what is left

The move to `plazavolcanes.com` is finished and verified. Nothing here blocks
production; each item is a loose end with a trigger telling you when it starts
to matter. Delete an entry once it is done.

Background for all of it: `docs/auth-url-configuration.md`.

## 1. The preview wildcard names the wrong slug

**Trigger:** the next time you want to register or sign in on a preview deploy.

Authentication → URL Configuration → Redirect URLs currently holds

```
https://*-plazavolcanes.vercel.app/**
```

which matches no hostname that exists. Vercel serves previews from the **team**
slug, not the project name:

```
plazavolcanes-2b5ra75x4-brilliantai.vercel.app
plazavolcanes-git-main-brilliantai.vercel.app
```

Replace the entry with

```
https://*-brilliantai.vercel.app/**
```

Until then a preview deploy's sign-up falls back to the production Site URL, so
the confirmation link leaves the preview you were testing. Production is not
affected — it matches the exact entry above it in the list.

## 2. Vercel wants newer DNS record targets

**Trigger:** before Vercel retires the current targets. No deadline announced.

Both rows on Project → Settings → Domains carry a **DNS Change Recommended**
badge. Nothing is broken: apex and `www` both answer 200 with a valid
certificate. Cloudflare currently holds

```
plazavolcanes.com      A     76.76.21.21
www.plazavolcanes.com  CNAME cname.vercel-dns.com
```

Open **View DNS configuration** on each row, copy the values Vercel prints —
do not reuse the ones above, they are what is there now — and edit the two
records in Cloudflare. Keep both **grey cloud / DNS-only**: Cloudflare is
nameservers only here, and proxying would put a second CDN in front of Vercel.
Press **Refresh** on the row afterwards; the badge clears within a TTL or two.

## 3. Confirmation email needs custom SMTP before it can be switched on

**Trigger:** the day you want registration to verify addresses.

Email confirmation is off, so nothing sends mail today and nothing is wrong.
Supabase's built-in mailer only delivers to addresses belonging to the project's
team members, at roughly two messages an hour, and neither limit raises an
error — a stranger registering would simply never hear back.

So the order is: custom SMTP first, then turn on **Authentication → Sign In /
Providers → Email → Confirm email**. Configuring SMTP also unlocks template
editing, which is why that page is read-only right now.

Setting it up means picking a provider, verifying `plazavolcanes.com` through
DNS records in Cloudflare, and filling Project Settings → Authentication → SMTP
Settings. `/auth/confirm` already handles both Supabase flows, so no code
changes.

## 4. Add the recovery route to the redirect allowlist

**Trigger:** before anyone uses password recovery on production.

Password reset sends people to `/auth/recuperar`, a different path from the
signup confirmation, so it needs its own entry in Authentication → URL
Configuration → Redirect URLs:

```
https://plazavolcanes.com/auth/recuperar
```

Without it Supabase drops the redirect and falls back to the Site URL, which
lands the person on the home page still holding a recovery session and no way to
set a password. The localhost equivalents are already in
`supabase/config.toml`.

The feature also needs custom SMTP to reach anybody, for the reason in item 3 —
recovery is entirely email, with no confirmation-off escape hatch.

## 5. Confirm the Supabase Site URL actually saved

**Trigger:** now, one glance.

The dashboard showed `https://plazavolcanes.com` in the Site URL field with a
live **Save changes** button, which is also what an unsaved edit looks like.
Nothing outside the dashboard can read that value back. Open Authentication →
URL Configuration and check the button is idle.

## Already verified, for contrast

- `NEXT_PUBLIC_SITE_URL` reaches production: `plazavolcanes.com/robots.txt`
  prints the real domain in its `Host:` and `Sitemap:` lines.
- `www` redirects to the apex with a 308 that preserves path and query, so an
  auth callback arriving on `www` keeps its `token_hash`.
- The sitemap lists the home page, every state page, and public shops and
  products on the production host.
- The confirm-signup template is untouched, which is the state that works.
