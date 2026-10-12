# Confirmation recovery and email configuration

Production failure reported: opening a signup email showed a confirmation error,
but subsequent password sign-in succeeded. This proves that account could sign
in; it does not identify the original callback error. No production Auth logs,
email body or dashboard settings were supplied or changed during this fix.

## What the application now guarantees

- `/auth/confirm` distinguishes a failed PKCE session exchange from a token that
  could not be verified. Neither failure asserts that an account is confirmed.
- Automatic continuation requires a successful Auth response containing both a
  session and `user.email_confirmed_at`. An unrelated existing browser session,
  a query parameter, or user metadata is not confirmation evidence.
- Callback cookie-write failures use recovery instead of silently reporting
  successful sign-in. Read-only Server Components retain proxy refresh behavior.
- Recovery sign-in and resend retain `intent=vender` and validated `continuar`.
  Successful authentication resumes a pending purchase cookie first, then a safe
  continuation, then seller shop creation at `/panel/tiendas/nueva` or `/panel`.
- Purchase context is browser-local. Opening email elsewhere cannot transfer a
  purchase cookie. Return to the shopping browser to resume that purchase.
- Expired, missing and already-used links offer password sign-in plus
  `/confirmar-correo`. Resend uses `auth.resend({ type: "signup" })`, never an
  account lookup, account creation, or administrator credentials. Missing,
  confirmed, pending and rate-limited addresses receive the same response.
- Provider email confirmation, expiry, one-time tokens and rate limits remain
  enforced. Resend acceptance is not a guarantee of email delivery.

## Why different-browser and overlapping signups matter

Installed `@supabase/ssr` uses PKCE. The stock `ConfirmationURL` first verifies
email at Supabase, then redirects to the application with a code. Session
exchange needs the verifier saved in the signup browser. Another browser lacks
it; a later signup in the same browser can overwrite it. Thus email verification
can succeed while automatic sign-in fails. Those mechanisms match the report,
but neither is established as its production cause.

The application supports existing PKCE emails and direct `token_hash` signup
emails. The latter verify and establish a session through the Auth server without
using the signup browser's verifier. Recovery remains necessary for old, expired,
already-used, or pre-consumed emails.

References: [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## Required hosted configuration review before release

Code alone does not replace the hosted email template or redirect allowlist.
These changes were prepared locally, not applied to production.

1. Keep **Authentication → Email → Confirm email** enabled. Never turn it off
   to work around confirmation recovery.
2. Verify `NEXT_PUBLIC_SITE_URL=https://plazavolcanes.com` in the deployed app and
   **Authentication → URL Configuration → Site URL** matches that origin.
   Public environment variables are build-time values; changes require a future
   build/release. Use the canonical origin.
3. Check **Redirect URLs** accepts the complete callback including its query.
   Retain the legacy URL and add the query pattern below (backslash is literal
   in the dashboard, not doubled):

   ```text
   https://plazavolcanes.com/auth/confirm
   https://plazavolcanes.com/auth/confirm\?**
   ```

   The escaped `\?` matches a literal question mark; `**` permits encoded
   continuation values. This keeps the callback path fixed. Add only intended
   preview/local origins to their corresponding environment. Do not use an
   unrestricted production origin wildcard.
4. In **Email Templates → Confirm signup**, use the prepared
   `supabase/templates/confirmation.html`, especially this link:

   ```html
   <a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}">Confirmar mi correo</a>
   ```

   Signup and resend always pass a full target such as:

   ```text
   https://plazavolcanes.com/auth/confirm?type=signup&intent=vender
   ```

   `RedirectTo` already contains `/auth/confirm` and its query. Do not append
   `/auth/confirm` again, add a second `?`, or replace it with `SiteURL`:
   those forms lose context or construct an invalid callback. `type=signup`
   is a token purpose, not a claim that verification succeeded. Keep password
   recovery templates targeting `/auth/recuperar` unchanged.
5. Verify custom SMTP delivery and disable provider link tracking. Inspect a
   newly delivered signup **and resend** email: callback host, query context and
   `token_hash` must survive template rendering. Email scanners may consume
   one-time links; this recovery does not prevent scanning. If template editing
   or real-user delivery is unavailable, configure supported SMTP instead of
   disabling confirmation. Retaining the stock template keeps browser-bound
   automatic sign-in; code recovery still provides password sign-in.

## Local configuration and testing

`supabase/config.toml` references the prepared template and permits its callback
query at the existing local origins. Existing local auto-confirm behavior was
not changed; production settings cannot be inferred from it. For confirmation
browser tests, use a dedicated local Auth service with confirmations enabled,
that template, a loopback redirect allowlist and the local inbox.

Do not run `supabase config push`: this file contains local URLs and would
replace hosted configuration.

Run `npm test`, `npm run typecheck`, and `npm run lint`. Opt-in browser coverage
is `tests/e2e/confirmation-recovery.spec.ts`, gated by `CONFIRMATION_E2E=1`.
It refuses non-loopback Auth/inbox URLs and requires `mailer_autoconfirm=false`.
Run it against the dedicated local confirmation setup; the ordinary
`npm run test:e2e` suites expect auto-confirming local signup.

For a dedicated local stack, set `auth.email.enable_confirmations=true`,
`auth.email.otp_expiry=15` and `auth.email.max_frequency="1s"`, then restart
that local service. Never push these test settings to a hosted project. Start
the app on `localhost:3000` with the **local** URL and publishable key reported
by `supabase status`; do not let `.env.local` select a hosted project. Keep
`NEXT_PUBLIC_SITE_URL=http://localhost:3000` and browser origin consistent.
With that app already running, invoke:

```sh
CONFIRMATION_E2E=1 CONFIRMATION_OTP_EXP_SECONDS=15 \
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=REPLACE_WITH_LOCAL_PUBLISHABLE_KEY \
npx playwright test tests/e2e/confirmation-recovery.spec.ts --workers=1
```

Use the local key value in place of the placeholder. The suite expects the
installed local Mailpit inbox at `http://127.0.0.1:54324`; use
`CONFIRMATION_INBOX_URL` for a different local port. Without the short-expiry
environment value, the timed-expiry scenario is explicitly skipped.

During this fix, all nine Chromium scenarios passed against a temporary local
Auth service with confirmation enabled, 15-second expiry, the prepared template,
the escaped-query allowlist pattern and local Mailpit. This reproduced the
missing-verifier and overwritten-verifier failures, and verified password
recovery to seller shop creation. The original local auto-confirm service was
left running unchanged; the temporary service was removed. The combined
confirmation-plus-purchase database browser flow was not exercised; purchase
precedence and failure preservation have unit coverage.

Browser acceptance checks:

1. Register through `/registro?vender=1`. Open the direct email in a fresh
   browser and reach `/panel/tiendas/nueva`; reload to prove cookies persisted.
2. Open a stock PKCE link in the signup browser and then, with another account,
   in a fresh browser. The latter must offer recovery sign-in without claiming
   confirmation; correct credentials must reach shop creation.
3. Start two signups in one browser before opening either email. The earlier
   stock PKCE link must recover through sign-in. Direct token-hash links must
   work without the browser verifier.
4. Reopen a consumed direct link signed out. Sign-in must still work and retain
   seller intent. For a pending account, follow an invalid/expired link, resend,
   then use the new email. A controlled actual time-expiry check is separate
   from the invalid-token test.
5. Verify safe continuation outranks seller intent. Unit regressions also prove
   pending purchase resumption outranks both and failure never consumes it.

Hosted mail delivery, deployed template rendering, redirects across canonical
hosts, real mailbox scanners, production logs, and actual timed expiration need
separate verification on the intended hosted configuration. Do not declare a
production cause or complete production resolution from local tests alone.
