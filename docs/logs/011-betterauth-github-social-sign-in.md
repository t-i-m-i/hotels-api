# 011 — BetterAuth Phase 2: GitHub social sign-in

Follows on from `docs/logs/010-betterauth-email-password.md`. Plan and full account
live in `docs/plans/better-auth.md`.

## What changed

- `src/auth/auth.ts`: added `socialProviders.github`, reading `GITHUB_CLIENT_ID`/
  `GITHUB_CLIENT_SECRET` from `.env`.
- `.env.example`: documents the GitHub OAuth App setup (homepage URL, callback URL).
- No schema changes — `accounts` was already designed to hold multiple provider rows
  per user (Phase 1's `create-accounts-table.sql`).
- `docs/guides/authentication.md`: documents the GitHub sign-in route and the
  browser-only testing gotcha below.

## Gotcha

`POST /api/auth/sign-in/social` sets a short-lived `better-auth.state` cookie that has
to round-trip through the *same browser* GitHub redirects back to. Testing the
initiation with `curl` gets back a perfectly valid GitHub authorize URL — but opening
that URL in an actual browser separately fails with `state_mismatch`, because the
state cookie was set on the `curl` request, not in the browser. The flow has to be
initiated from a real browser tab on this app's own origin (e.g. a `fetch()` call from
DevTools console on `/api`) for the cookie to land where the callback needs it.

## Manual verification

Full browser round-trip (authorize → GitHub login → callback → `/me`) confirmed
working. Database rows after a real GitHub sign-in:

- `users`: `name`/`email` from the GitHub profile, `email_verified: true` (GitHub
  emails are pre-verified), `image` set to the GitHub avatar URL, `role_id` defaulted
  to `2` (guest) — same default as email sign-ups.
- `accounts`: `provider_id: "github"`, `account_id` = GitHub's numeric user id, access
  token stored.
