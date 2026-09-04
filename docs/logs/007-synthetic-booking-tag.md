# 007 — Tagging synthetic bookings instead of matching by name/dates

## Why

The RN app's Maestro flow (`hotels`'s `.maestro/cleanup-booking.js`) was
cleaning up the booking it creates by re-`GET`ing `/bookings` and finding
the row whose hotel name contained the search term and whose
`checkIn`/`checkOut` matched what `compute-dates.js` had picked — a
heuristic, not an identity. It worked, but "the booking that happens to
have these dates on a hotel matching this name" is exactly the kind of
match that breaks the moment two suites (or two runs) pick the same
range, which `hotels-web-next`'s Playwright suite already does. Replaced
the heuristic with a real tag set at creation time.

## What was added

- **Migration** `migrations/..._add-is-synthetic-to-bookings.sql`: `bookings.is_synthetic boolean not null default false`.
- **`POST /bookings`** now reads an optional `X-Synthetic-Booking: true`
  header (`@Headers('x-synthetic-booking')` in `BookingsController.create`)
  and passes it through to `BookingsService.create(dto, isSynthetic)`,
  which includes it in the `INSERT`. Deliberately a header, not a
  `CreateBookingDto` field — it's metadata about *who's asking*
  (an e2e suite vs. a real client), not part of the booking itself, and
  keeping it out of the DTO means the public contract real client apps
  generate types from never gains a field they could accidentally set.
- **`DELETE /bookings/synthetic`** — bulk-deletes every row with
  `is_synthetic = true`, returns `{ deletedCount }`
  (`DeleteSyntheticBookingsDto`). Declared *before* `DELETE /bookings/:id`
  in the controller — Nest matches routes in file order, so the literal
  `synthetic` segment has to come first or it'd be swallowed by the `:id`
  route with `id="synthetic"` (fails `ParseUUIDPipe`, 400).

Regenerated `docs/openapi.json` (new endpoint + header param — contract
change, so the usual rule applies) and confirmed both `hotels-web-next`
and `hotels` picked up the new types via their own
`generate:api-types`.

## Gotcha: duplicate parameter from case mismatch

First pass declared `@ApiHeader({ name: 'X-Synthetic-Booking', ... })`
(capitalized, matching the header's conventional casing) while the
handler read it via `@Headers('x-synthetic-booking')` (lowercase, since
HTTP header names are case-insensitive and Nest's `@Headers()` lowercases
internally). `@nestjs/swagger` doesn't know those refer to the same
header — it auto-detects `@Headers()`-decorated params and adds its own
`ApiHeader` entry unless the name matches an explicit one *exactly*, so
the generated spec ended up with two parameters: an auto-inferred
`x-synthetic-booking` (required, no description) and the explicit
`X-Synthetic-Booking` (optional, documented) — different casing, treated
as different fields. `openapi-typescript` then generated a TS type
requiring the auto-inferred one, breaking `hotels-web-next`'s
`tsc --noEmit`. Fixed by lowercasing the `@ApiHeader` name to match the
`@Headers()` call exactly.

## Verified

Live against the dev server and shared DB: `POST /bookings` with
`X-Synthetic-Booking: true` → row has `is_synthetic = true`; a
same-request without the header → `is_synthetic = false`; `DELETE
/bookings/synthetic` afterward removed only the tagged row
(`{"deletedCount":1}`), the untagged one stayed reachable via
`GET /bookings/:id` (`200`). Full `bun run test`/`test:e2e` and both
frontends' `tsc --noEmit` clean.

## What still uses the old approach, and why that's fine

`hotels-web-next`'s Playwright test still deletes by the exact id it
captured from the post-submit redirect URL (`e2e/booking-flow.spec.ts`'s
`afterEach`), rather than switching to `DELETE /bookings/synthetic`. Kept
deliberately: that suite already had zero ambiguity (it knows precisely
which row it created), and per-id delete stays correct under parallel
test runs in a way a shared "delete everything tagged synthetic" bulk
op wouldn't (one test's cleanup could delete another concurrently-running
test's still-in-progress booking). It *does* now also send
`X-Synthetic-Booking: true` (gated on `E2E_TEST_MODE`, set only in
`playwright.config.ts`'s `webServer.env`) purely as a second line of
defense — so a crashed run's orphaned row is still visible/sweepable by
this bulk endpoint even though normal runs never rely on it.
