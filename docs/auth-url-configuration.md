# Auth URL configuration checklist

Confirmation and password-reset emails depend on four settings that live in four
different places. Every one of them fails **silently** — no error, no log, just a
link pointing somewhere wrong. This is the list to walk when auth email links
misbehave, and after any domain change.

## How the pieces fit

`lib/actions/auth.ts` builds the link target:

```ts
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
// ...
emailRedirectTo: `${siteUrl}/auth/confirm`
```

Supabase then checks that URL against an allowlist. If it is not on the list,
Auth **discards it and falls back to the project's Site URL** without
complaining. `app/auth/confirm/route.ts` handles both the `code` and
`token_hash` flows, so a misrouted link still *works* — it just works on the
wrong host, which is why this breaks quietly.

## The four checks

### 1. Vercel has `NEXT_PUBLIC_SITE_URL`

Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SITE_URL = https://plazavolcanes.vercel.app
```

`.env.local` is matched by `.env*` in `.gitignore` and never reaches Vercel. If
this is unset in production, the fallback above makes every production
confirmation email point at `http://localhost:3000`.

Include the scheme. `plazavolcanes.vercel.app/auth/confirm` with no `https://`
is not a valid absolute URL and will not match the allowlist.

### 2. Site URL in the Supabase dashboard

Authentication → URL Configuration → **Site URL**:

```
https://plazavolcanes.vercel.app
```

This is the default target when no `redirectTo` is passed, and it fills
`{{ .SiteURL }}` in email templates. If it still says `localhost`, that is where
users land whenever check 3 fails.

### 3. The redirect allowlist

Authentication → URL Configuration → **Redirect URLs**:

```
https://plazavolcanes.vercel.app/auth/confirm
```

Add wildcard entries for local work and Vercel previews, which get a unique URL
per deployment that would otherwise never match:

```
http://localhost:3000/**
http://127.0.0.1:3000/**
https://*-<team-or-account-slug>.vercel.app/**
```

Wildcard semantics: `*` does not cross `.` or `/`; `**` does. So
`http://localhost:3000/*` matches `/foo` but not `/foo/bar`. Prefer the exact
path for the production entry and keep wildcards for previews.

### 4. The email template uses `{{ .RedirectTo }}`

Authentication → Email Templates → Confirm signup.

```html
<!-- Ignores emailRedirectTo entirely -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">

<!-- Honours it -->
<a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
```

`{{ .SiteURL }}` is the project setting, not the value the code passed. A
template left on the default silently overrides everything checks 1–3 achieve.

## Do not run `supabase config push`

`supabase/config.toml` holds the **local** values:

```toml
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = [
  "http://127.0.0.1:3000/auth/confirm",
  "http://localhost:3000/auth/confirm",
]
```

Those are correct for local development. `supabase config push` writes this file
to the **linked remote project**, which would set production's Site URL to
localhost and replace the allowlist with two localhost entries. Every
confirmation email in production would then point at a machine that is not the
user's.

The CLI has no matching read command, so production values can only be inspected
in the dashboard. Nothing in this repository reflects them.

## Verifying

There is no way to check this from code — the allowlist is not exposed through
the Management API or the CLI. Confirm it end to end instead:

1. Register a real address on production.
2. Read the confirmation email and check the link's **host** before clicking.
3. Click it and confirm you land on `/panel` signed in.

A link pointing at `localhost` means check 1 or 2. A link on the right host that
lands signed-out means the token flow, not the URL configuration.
