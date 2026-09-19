# BetterAuth implementation plan

> Phase 1 (email/password) is implemented — see "Phase 1 implementation notes" at the
> bottom for what changed from this plan during implementation.

## Decisions

- **User table**: extend the existing `users` table to be BetterAuth's `user` model
  (`modelName: "users"`), instead of creating a parallel identity table. `bookings.user_id`
  keeps pointing at the same table/PK — no data migration needed. `role_id`, `first_name`,
  `last_name` stay as app-specific columns BetterAuth doesn't touch.
- **New tables** (`sessions`, `accounts`, `verifications`): plural, snake_case, `uuid PRIMARY KEY
  DEFAULT gen_random_uuid()` — matching the convention already used by `hotels` / `bookings` /
  `roles`, via BetterAuth's `modelName` / `fields` config rather than accepting its default
  singular/camelCase naming.
- **ID generation**: no `advanced.database.generateId` override needed — BetterAuth already
  defers to the database for UUID generation on Postgres adapters. Just declare `DEFAULT
  gen_random_uuid()` on every new table's `id` column, same as elsewhere in this schema.
- **Integration**: `@thallesp/nestjs-better-auth` (Express-based, matches
  `@nestjs/platform-express`) — gives a NestJS module, `AuthGuard`, and `@Session()` decorator
  instead of hand-rolling the Express handler mount.
- **Phasing**: Phase 1 = email/password auth. Phase 2 = add GitHub as one social provider
  example.

## Libraries to install

- `better-auth` — core, talks to Postgres directly via the existing `PG_POOL` (`pg.Pool`), no
  ORM adapter needed.
- `@thallesp/nestjs-better-auth` — NestJS integration.
- Nothing extra for GitHub — `socialProviders.github` is built into `better-auth` core; just
  needs a GitHub OAuth App's client id/secret in `.env` for Phase 2.

## Schema changes

1. **Migration: extend `users`** — add the columns BetterAuth's `user` model expects that don't
   exist yet:
   - `email_verified boolean NOT NULL DEFAULT false`
   - `image text` (nullable)
   - Map BetterAuth's `name` field to a computed/concatenated value or keep `first_name`/
     `last_name` and expose a combined `name` via `fields` mapping — needs a small decision at
     implementation time (BetterAuth expects a single `name` field; your schema has two). Likely
     simplest: add a generated column or just require `name` and drop the first/last split — flag
     for discussion when we implement, not blocking the plan.
   - Existing `role_id`, `created_at`, `updated_at` map directly (`fields: { createdAt:
     "created_at", updatedAt: "updated_at" }`).

2. **New migration: `sessions`** — token, `user_id → users(id)`, `expires_at`, `ip_address`,
   `user_agent`, `created_at`, `updated_at`.

3. **New migration: `accounts`** — for both credential (email/password) and OAuth (GitHub)
   identities: `user_id → users(id)`, `account_id`, `provider_id`, `access_token`,
   `refresh_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `id_token`,
   `password` (nullable, for the credential provider), `created_at`, `updated_at`.

4. **New migration: `verifications`** — for email verification / password reset tokens:
   `identifier`, `value`, `expires_at`, `created_at`, `updated_at`.

Generate the authoritative column list/types by running `npx @better-auth/cli generate` against
a draft `auth.ts` config (with `modelName`/`fields` mappings and the email+github providers
already declared), then hand-adapt the emitted SQL into `node-pg-migrate` files rather than
letting the CLI apply migrations directly — keeps everything in `migrations/` alongside the rest
of the schema history.

## Config sketch (for implementation time, not final)

```ts
export const auth = betterAuth({
  database: pgPool, // existing PG_POOL
  user: {
    modelName: 'users',
    fields: { emailVerified: 'email_verified', createdAt: 'created_at', updatedAt: 'updated_at' },
  },
  session: {
    modelName: 'sessions',
    fields: { userId: 'user_id', expiresAt: 'expires_at', ipAddress: 'ip_address', userAgent: 'user_agent', createdAt: 'created_at', updatedAt: 'updated_at' },
  },
  account: {
    modelName: 'accounts',
    fields: { userId: 'user_id', accountId: 'account_id', providerId: 'provider_id', /* ... */ },
  },
  verification: {
    modelName: 'verifications',
    fields: { expiresAt: 'expires_at', createdAt: 'created_at', updatedAt: 'updated_at' },
  },
  emailAndPassword: { enabled: true }, // Phase 1
  // socialProviders: { github: { clientId, clientSecret } }, // Phase 2
});
```

## Implementation phases

**Phase 1 — email/password**
1. Install `better-auth`, `@thallesp/nestjs-better-auth`.
2. Migration: extend `users` (email_verified, image, name handling).
3. Migrations: create `sessions`, `accounts`, `verifications`.
4. `src/auth/auth.config.ts` (or similar) with the `betterAuth()` instance + field mappings above.
5. Wire `BetterAuthModule` into `AppModule`, mount the handler.
6. Guard a sample route (or add a `/me` endpoint) to prove sessions work end-to-end.
7. `bun run generate:openapi` if any new routes/DTOs are added to the public contract.

**Phase 2 — GitHub social provider**
1. Register a GitHub OAuth App, add `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` to `.env` (+
   `.env.example`).
2. Add `socialProviders.github` to the auth config.
3. Verify the `accounts` table correctly stores a second provider row per user (no schema change
   expected — `accounts` was already designed for multiple providers per user in Phase 1).

## Open items to settle during implementation (not blocking this plan)

- How to reconcile BetterAuth's single `name` field with the existing `first_name`/`last_name`
  split on `users`.
- Whether `sessions`/`accounts`/`verifications` migrations should be generated once via the
  BetterAuth CLI against Neon directly, or written by hand from BetterAuth's documented default
  schema (CLI generation is less error-prone if the CLI can reach `DATABASE_URL` from this repo).

## Phase 1 implementation notes

Decided during implementation, superseding the "open items" above:

- **`name` is a real, independent field** — not derived from `first_name`/`last_name`. Sign-up
  asks for `name` + `email` + `password`, matching BetterAuth's native `/sign-up/email` contract
  as-is (no wrapper controller needed). `first_name`/`last_name` stay populated for the existing
  seeded users only; new BetterAuth sign-ups leave them `NULL` (columns relaxed to nullable).
  Rationale: `name` doubles as a future public-facing display name (e.g. review author) distinct
  from the user's real name.
- **`role_id` needed a default.** It's `NOT NULL` with no default and BetterAuth's sign-up never
  sets it — without a default, every self-registered sign-up would fail the FK/NOT NULL
  constraint. Added `ALTER COLUMN role_id SET DEFAULT 2` (`2` = `guest`, see
  `create-roles-table.sql`) in the same migration that relaxes `first_name`/`last_name`.
- **Migrations were written by hand**, not CLI-generated — `npx @better-auth/cli generate`
  wasn't used in the end; the four migration files under `migrations/` were authored directly
  against BetterAuth's documented default schema plus the `fields` mappings in `src/auth/auth.ts`.
- **`generateId` needed an explicit override, contrary to the docs.** The installed version
  (`better-auth@1.7.5`) does *not* default to DB-generated UUIDs for Postgres — verified by
  direct testing: without `advanced.database.generateId` set, it always generates a client-side
  nanoid-style string (e.g. `ySisKqXObT8E0zTEWCTMbR2IrBV2yhiY`), which fails against this
  schema's `uuid` columns (`invalid input syntax for type uuid`). Fixed with
  `advanced.database.generateId: "uuid"` in `src/auth/auth.ts`, which makes it generate a real
  `crypto.randomUUID()` client-side instead (not DB-`DEFAULT`-generated, but a valid UUID,
  consistent with the rest of the schema).
- **Global `AuthGuard`.** `@thallesp/nestjs-better-auth`'s `AuthModule` registers an `AuthGuard`
  globally — every Nest route requires a session by default. `HotelsController` and
  `BookingsController` are marked `@AllowAnonymous()` to keep current "nothing is gated"
  behavior; the new `GET /me` (`src/auth/me.controller.ts`) is left protected as the Phase 1
  proof that sessions work end-to-end.
- **`main.ts` needs `bodyParser: false`** in `NestFactory.create()` — the library needs the raw
  request body for its own routes and re-adds body parsing for everything else.
- **Auth routes bypass the OpenAPI contract.** `@thallesp/nestjs-better-auth` mounts BetterAuth's
  own handler for `/api/auth/*` (sign-up, sign-in, session, sign-out, etc.) — these are raw
  Express routes, not Nest controllers, so they never go through `@nestjs/swagger` and don't
  appear in `docs/openapi.json`. This is expected/standard for this library, not a gap to fix.
  Only the hand-written `GET /me` route is part of the generated OpenAPI contract.
- **Jest couldn't load the package** — `@thallesp/nestjs-better-auth` ships ESM-only (`.mjs`,
  uses top-level `import.meta.url`), which the CJS-based Jest/ts-jest setup this project had
  couldn't execute. Fixed for real by migrating Jest to run under Node's
  `--experimental-vm-modules` (see `tsconfig.jest.json`, `package.json`'s `jest` key, and
  `test/jest-e2e.json`) — both `bun run test` (unit) and `bun run test:e2e` now load the real,
  unmocked `@thallesp/nestjs-better-auth` package. That same migration surfaced an unrelated,
  pre-existing hazard between `@bull-board/nestjs` and `@nestjs/bull-shared`
  (`"type": "module"`), fixed with a small manual mock scoped to e2e tests
  (`test/__mocks__/@bull-board/nestjs.ts`) — see the log for details. All of `type-check`,
  `lint`, `test`, and `test:e2e` are green.

## Manual verification performed

- `POST /api/auth/sign-up/email` → 200, creates a `users` row (`role_id` defaulted to 2,
  `first_name`/`last_name` `NULL`) and an `accounts` row (`provider_id: "credential"`, hashed
  password).
- `POST /api/auth/sign-in/email` → 200, returns a session token.
- `GET /api/auth/get-session` → returns the session with cookie, `null` without.
- `GET /me` → 401 without a session cookie, 200 with one.
- `GET /hotels`, `GET /bookings` → still 200 with no auth (unaffected by the global guard).
- `bun run type-check`, `bun run test` (unit) both pass.
