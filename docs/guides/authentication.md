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
- `user`/`session`/`account`/`verification` are mapped onto this project's own table
  names and snake_case columns (see `src/auth/auth.ts` and
  `docs/plans/better-auth.md` for why) — `users` is the same table `bookings.user_id`
  references, not a separate identity table.
- `GET /me` (`src/auth/me.controller.ts`) is a regular Nest route — not part of
  BetterAuth — kept as a minimal example of reading the session via `@Session()`.

## Route protection

`AuthModule` registers a global `AuthGuard` — every Nest route requires a session
**unless** its controller is marked `@AllowAnonymous()` or `@OptionalAuth()`
(from `@thallesp/nestjs-better-auth`). `HotelsController` and `BookingsController`
are marked `@AllowAnonymous()` so they stay open, per CLAUDE.md's "no authentication"
baseline; new controllers default to protected unless you opt out.
