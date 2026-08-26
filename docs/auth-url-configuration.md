# Auth URL configuration checklist

Confirmation and password-reset emails depend on four settings that live in four
different places. Every one of them fails **silently** — no error, no log, just a
link pointing somewhere wrong. This is the list to walk when auth email links
misbehave, and after any domain change.

The production domain is `https://plazavolcanes.com`. The Vercel-assigned
`*.vercel.app` URL still resolves, and preview deployments always will, which is
why the allowlist below keeps entries for both.

## How the pieces fit

`lib/site-url.ts` resolves the origin once:

```ts
const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
if (!configured) return "http://localhost:3000";
```

`lib/actions/auth.ts` builds the link target from it:

```ts
emailRedirectTo: buildSiteUrl("/auth/confirm")
```

Supabase then checks that URL against an allowlist. If it is not on the list,
Auth **discards it and falls back to the project's Site URL** without
complaining. `app/auth/confirm/route.ts` handles both the `code` and
`token_hash` flows, so a misrouted link still *works* — it just works on the
wrong host, which is why this breaks quietly.

`NEXT_PUBLIC_SITE_URL` is also what `metadataBase`, `app/robots.ts` and
`app/sitemap.ts` build absolute URLs from, so a wrong value there leaks into
canonical URLs and the sitemap as well as into email.

## The four checks

### 1. Vercel has `NEXT_PUBLIC_SITE_URL`

Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_SITE_URL = https://plazavolcanes.com
```

`.env.local` is matched by `.env*` in `.gitignore` and never reaches Vercel. If
this is unset in production, the fallback above makes every production
confirmation email point at `http://localhost:3000`.

`NEXT_PUBLIC_*` values are inlined at build time. Changing this variable does
nothing until the next deploy — **redeploy after saving it**.

Include the scheme. `plazavolcanes.com/auth/confirm` with no `https://` is not a
valid absolute URL; `getSiteUrl()` assumes `https://` for a bare host, but
nothing repairs a typo in the host itself.

Point it at whichever host Vercel serves as canonical — apex or `www`, not both.
Vercel 308-redirects the other one, and a redirect in the middle of the auth
callback can drop the `code` or `token_hash` query parameter.

### 2. Site URL in the Supabase dashboard

Authentication → URL Configuration → **Site URL**:

```
https://plazavolcanes.com
```

This is the default target when no `redirectTo` is passed, and it fills
`{{ .SiteURL }}` in email templates. If it still says `localhost`, that is where
users land whenever check 3 fails.

### 3. The redirect allowlist

Authentication → URL Configuration → **Redirect URLs**:

```
https://plazavolcanes.com/auth/confirm
```

Add wildcard entries for local work and Vercel previews, which get a unique URL
per deployment that would otherwise never match:

```
http://localhost:3000/**
http://127.0.0.1:3000/**
https://*-brilliantai.vercel.app/**
```

The wildcard matches the Vercel **team** slug, not the project name: previews
are served from `plazavolcanes-<hash>-brilliantai.vercel.app`. An entry built
from the project name matches nothing, and previews then fall back to the
production Site URL.

Keep the production `*.vercel.app` entry too if anyone still reaches the site
that way:

```
https://plazavolcanes.vercel.app/auth/confirm
```

Wildcard semantics: `*` does not cross `.` or `/`; `**` does. So
`http://localhost:3000/*` matches `/foo` but not `/foo/bar`. Prefer the exact
path for the production entry and keep wildcards for previews.

### 4. The email template resolves the redirect

Authentication → Email Templates → Confirm signup.

On the built-in mailer this page is **read-only** — Supabase gates template
editing behind custom SMTP, because a shared sender plus editable markup is a
phishing vector. Locked is the safe state: the stock template links

```html
<a href="{{ .ConfirmationURL }}">Confirm your mail</a>
```

and `{{ .ConfirmationURL }}` expands to
`{project}.supabase.co/auth/v1/verify?token=...&type=signup&redirect_to=<the
value the code passed>`. It honours `emailRedirectTo`, as long as check 3 put
that URL on the allowlist.

The failure mode only appears once somebody edits the template:

```html
<!-- Ignores emailRedirectTo entirely -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">

<!-- Honours it -->
<a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
```

`{{ .SiteURL }}` is the project setting, not the value the code passed, so a
hand-edited template silently overrides everything checks 1-3 achieve.

## The built-in mailer does not reach real users

Two limits come with Supabase's shared SMTP, and neither raises an error:

- roughly **two emails an hour**, project-wide;
- delivery **only to addresses belonging to the project's team members**. A
  stranger who registers gets nothing.

So confirmation email is not something to switch on and walk away from. Either:

- leave **Authentication → Sign In / Providers → Email → Confirm email** off,
  which is how this project runs today — `/auth/confirm` still accepts both
  flows, so turning it on later needs no code change; or
- configure custom SMTP first (Project Settings → Authentication → SMTP
  Settings) with a provider whose domain you verify through DNS. That lifts both
  limits and unlocks template editing at the same time.

Checks 1-3 matter either way: password recovery, magic links and any future
email all resolve their redirect the same way.

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
the Management API or the CLI.

While email confirmation is off, registration never sends mail, so checks 2-4
have nothing to exercise them. Verify them when you turn confirmation on:

1. Register an address that belongs to a project team member, or a real address
   once custom SMTP is configured.
2. Read the confirmation email and check the link's **host** before clicking.
3. Click it and confirm you land on `/panel` signed in.

A link pointing at `localhost` means check 1 or 2. A link on the right host that
lands signed-out means the token flow, not the URL configuration. No email at
all is the shared-mailer limit above, not a URL problem.

`https://plazavolcanes.com/robots.txt` is a quicker smoke test for check 1: its
`Sitemap:` line prints whatever `NEXT_PUBLIC_SITE_URL` resolved to in the build
that is live.
