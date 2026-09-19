# Authentication

Auth is handled by [BetterAuth](https://www.better-auth.com/), mounted at `/api/auth/*`
by `@thallesp/nestjs-better-auth` (`src/auth/auth.ts`, wired into `AppModule`). Use its
own routes for sign-up, sign-in, sign-out, and session management — don't hand-roll
equivalents.

## Where the API shape lives

These routes are raw Express handlers, not Nest controllers, so they never go through
`@nestjs/swagger` and don't appear in `docs/openapi.json`. Instead of duplicating
BetterAuth's docs here, the app exposes a live, accurate reference generated from this
project's actual configured instance:

- **Interactive reference**: `GET /api/auth/reference` (a Scalar UI, same idea as
  `/api` for the rest of this API) — shows every enabled route (sign-up, sign-in,
  sign-out, session, etc.) with this app's real field shapes.
- **Raw schema**: `GET /api/auth/open-api/generate-schema`.

For general concepts (client SDKs, cookie/session behavior, provider configuration)
see BetterAuth's own docs at https://www.better-auth.com/docs.

## What's configured here

- `emailAndPassword` — enabled (Phase 1).
- `socialProviders.github` — enabled (Phase 2). Requires `GITHUB_CLIENT_ID`/
  `GITHUB_CLIENT_SECRET` in `.env` — see `.env.example` for how to create the GitHub
  OAuth App. Sign in with `POST /api/auth/sign-in/social` (`{"provider": "github"}`),
  which returns a GitHub authorize URL to redirect the browser to.
- `user`/`session`/`account`/`verification` are mapped onto this project's own table
  names and snake_case columns (see `src/auth/auth.ts` and
  `docs/plans/better-auth.md` for why) — `users` is the same table `bookings.user_id`
  references, not a separate identity table.
- `GET /me` (`src/auth/me.controller.ts`) is a regular Nest route — not part of
  BetterAuth — kept as a minimal example of reading the session via `@Session()`.

## Testing the social sign-in flow manually

`POST /api/auth/sign-in/social` sets a short-lived `better-auth.state` cookie that has
to round-trip through the *same browser* GitHub redirects back to — a tool like `curl`
gets back a valid authorize URL, but opening that URL in an actual browser separately
fails with `state_mismatch`, since the state cookie never reached that browser. Test
from a real browser tab on this app's own origin instead, e.g. open `/api` and run in
DevTools console:

```js
fetch('/api/auth/sign-in/social', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ provider: 'github', callbackURL: 'http://localhost:3000/me' }),
}).then(r => r.json()).then(d => (location.href = d.url));
```

## Route protection

`AuthModule` registers a global `AuthGuard` — every Nest route requires a session
**unless** its controller is marked `@AllowAnonymous()` or `@OptionalAuth()`
(from `@thallesp/nestjs-better-auth`). `HotelsController` and `BookingsController`
are marked `@AllowAnonymous()` so they stay open, per CLAUDE.md's "no authentication"
baseline; new controllers default to protected unless you opt out.
