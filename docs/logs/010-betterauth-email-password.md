# 010 — BetterAuth, Phase 1 (email/password)

Adds authentication via [BetterAuth](https://www.better-auth.com/), mounted through
`@thallesp/nestjs-better-auth`. Plan and full rationale live in
`docs/plans/better-auth.md`; usage pointers for consumers of this API are in
`docs/guides/authentication.md`. This log is the "what happened and what surprised us"
record.

## What changed

- 5 new migrations: extend `users` with `name`/`email_verified`/`image`; relax
  `first_name`/`last_name` to nullable and default `role_id` to `2` (guest) since
  BetterAuth-created users don't set them; create `sessions`/`accounts`/
  `verifications` (plural, snake_case, `uuid` PKs — matching the rest of the schema).
- `src/auth/auth.ts`: the `betterAuth()` instance, mapped onto the existing `users`
  table (not a separate identity table) via `modelName`/`fields`, plus the built-in
  `openAPI()` plugin for a live reference at `/api/auth/reference`.
- `AuthModule.forRoot({ auth })` wired into `AppModule`; `bodyParser: false` in
  `main.ts` (the library needs the raw body for its own routes and re-adds body
  parsing — `express.json`/`express.urlencoded` — for everything else via its own
  middleware).
- `HotelsController`/`BookingsController` marked `@AllowAnonymous()` — the library's
  `AuthGuard` is global, so without this every existing route would suddenly require a
  session, contradicting CLAUDE.md's "no authentication" baseline.
- `GET /me` (`src/auth/me.controller.ts`) — one real Nest route, added purely to prove
  `@Session()` + the global guard work end-to-end; it's the only auth-related route
  that shows up in `docs/openapi.json`.

## Gotchas

- **The docs are wrong about ID generation for this version.** `better-auth@1.7.5`
  does not default to DB-generated UUIDs on Postgres — verified by direct testing
  (traced through `@better-auth/core`'s `get-id-field.mjs`): without
  `advanced.database.generateId` set, it always generates a client-side nanoid-style
  string, which fails against `uuid` columns (`invalid input syntax for type uuid`).
  Needed `generateId: "uuid"` explicitly.
- **Jest couldn't load the package** — `@thallesp/nestjs-better-auth` ships ESM-only
  (`.mjs`, top-level `import.meta.url`), incompatible with the CJS-based ts-jest setup
  this repo had. Fixed by migrating Jest itself to run under Node's
  `--experimental-vm-modules` (real ESM), via `tsconfig.jest.json` +
  `ts-jest`'s `useESM: true` transform, for both the unit (`package.json`'s `jest` key)
  and e2e (`test/jest-e2e.json`) configs. Unit tests now load the real,
  unmocked package — no more manual mock needed (`useESM` under `@jest/globals`'s
  stricter `Mock` type needed `bookings.service.spec.ts`'s mock typed via
  `jest-mock`'s `Mock<...>` instead of the ambient `jest.Mock`).
- **E2E tests hit a separate, pre-existing dual-package hazard**, exposed only by
  turning Jest's real ESM mode on: `@nestjs/bull-shared` declares `"type": "module"`;
  `@bull-board/nestjs` (`QueueBoardModule`) `require()`s it synchronously, which plain
  Node's `require(esm)` handles fine but Jest's own ESM loader (`jest-runtime`'s
  `EsmLoader`) doesn't — it deterministically throws `Cannot require() ES Module ...
  it is currently being loaded by a concurrent import()`. Fixed with a manual mock
  (`test/__mocks__/@bull-board/nestjs.ts`, wired via `moduleNameMapper` in
  `test/jest-e2e.json` — Jest's automatic node_modules mock discovery didn't kick in
  here, so it's mapped explicitly) that no-ops `BullBoardModule`'s static methods.
  `QueueBoardModule` only uses this to mount the `/queues` debug dashboard, which
  `hotels.e2e-spec.ts` never touches — the real `QueueBoardModule` is untouched
  outside tests. Both `bun run test` and `bun run test:e2e` are fully green now.
- `role_id` is `NOT NULL` with no prior default — self-registered sign-ups would have
  failed the constraint without adding `DEFAULT 2`.
