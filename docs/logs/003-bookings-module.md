# 003 — Bookings module: create, read, and hotel-scoped availability

## What we did

Added a `BookingsModule` (`src/bookings/`) on top of `reservations`, the
table already created by an earlier migration but not yet served by any
endpoint. Scaffolded via `bunx nest g resource bookings`, then reshaped to
match the raw-`pg` conventions established by `HotelsModule` rather than
the ORM-flavored defaults the generator assumes:

```
src/bookings/
  bookings.module.ts
  bookings.controller.ts   # POST /bookings, GET /bookings, GET /bookings/hotel/:hotelId, GET /bookings/:id
  bookings.service.ts      # pg queries + row→DTO mappers, no ORM
  dto/
    create-booking.dto.ts  # CreateBookingDto — hotelId, checkIn, checkOut (no userId, see below)
    update-booking.dto.ts  # PartialType(CreateBookingDto) — unused for now, stubbed
    booking.dto.ts          # BookingDto (flat) + BookingHotelSummaryDto/BookingUserSummaryDto/BookingDetailsDto (nested)
```

Deleted the generator's `entities/booking.entity.ts` — that's a
TypeORM/Prisma convention (a class mapped to a table via decorators); this
app has no ORM, so `HotelsService`'s pattern (a plain `type FooRow`
matching the SQL columns, plus a `toFooDto()` mapper) is what `bookings`
follows too.

## Two response shapes, on purpose

`BookingDto` (flat: `id`, `userId`, `hotelId`, `checkIn`, `checkOut`) is
what `create`/`findOne`/`findCurrentByHotel` return — a booking is just
foreign keys + dates from those callers' point of view.

`findAll` (the "all bookings, for admin/reporting" list) instead returns
`BookingDetailsDto`, which nests `BookingHotelSummaryDto { name }` and
`BookingUserSummaryDto { firstName, lastName }` — built from a query that
`LEFT JOIN`s `hotels` and `users` onto `reservations`. Nesting mirrors
`HotelDto`'s existing `GeoDto` pattern rather than flattening
`hotelName`/`userFirstName` onto the top level.

These aren't interchangeable and deliberately don't share a base type via
`PickType`/`IntersectionType` — `BookingDto`'s `checkIn`/`checkOut` naming
already diverges from `BookingDetailsDto` by more than just "plus an id",
and the two are populated by structurally different queries (one table vs.
two `LEFT JOIN`s). Forcing them into one hierarchy would only save a few
`@ApiProperty()` lines at the cost of coupling two independently-evolving
response shapes.

## `GET /bookings/hotel/:hotelId` — route-ordering gotcha

Added to support the web app's "disable already-booked days" calendar
feature: date ranges only, `check_out >= CURRENT_DATE` (no booking
`status` field exists yet, so "current" just means "hasn't ended"), no
join — the calendar doesn't need hotel/user names.

**This route must be declared before `@Get(':id')` in the controller.**
Nest/Express match routes in declaration order; `:id` is a catch-all
param segment, so a request to `/bookings/hotel/<uuid>` would otherwise be
swallowed by `findOne` with `"hotel"` bound as `id`. Controller method
order is `create` → `findAll` → `findCurrentByHotel` → `findOne` →
`update` → `remove`, and it has to stay that way if more `/bookings/...`
sub-routes get added later — worth remembering, this bit in dev before we
caught it.

`hotelId` is validated with `ParseUUIDPipe` on the `@Param()` directly,
since path params aren't covered by the global DTO `ValidationPipe` the
way `@Body()`/`@Query()` are — there's no DTO class for a bare string
segment, so this is the equivalent of `@IsUUID()` for a path param.

## `userId` isn't client-supplied, and won't be until auth exists

`CreateBookingDto` intentionally has no `userId` field. `BookingsService
.create()` hardcodes a placeholder id instead
(`// TODO(auth): replace with the authenticated user's id once BetterAuth
is wired in`). This isn't a shortcut to fix later so much as a security
boundary being enforced from day one: a client-supplied `userId` on a
create request is a textbook IDOR (any caller could book on someone
else's behalf just by changing a field). The eventual real version routes
identity through a Guard (`@UseGuards`) + a `@CurrentUser()` param
decorator reading off `request.user`, populated by whatever verifies the
BetterAuth session — mirrors the Fastify/Clerk `preHandler`-decorates-
`request` pattern from `imovum-api`, just expressed via Nest's Guard/DI
machinery instead of a plugin hook.

## Known gaps, deliberately not done yet

- **No validation beyond shape.** `checkIn >= today`, `checkOut > checkIn`,
  and "no overlap with an existing booking for this hotel" are all
  unimplemented. The first is a one-line `@MinDate()` addition to the DTO;
  the second is simple enough to do as a manual check in the service
  rather than a custom `class-validator` decorator; the third needs a DB
  query (`existing.check_in < new.check_out AND existing.check_out >
  new.check_in`) and can't live on the DTO at all. None of this is wired
  up — right now the API will happily accept a checkout before checkin, or
  double-book a hotel, if called directly (Swagger, curl) rather than
  through the web app's disabled-day picker.
- **No transaction/exclusion-constraint protection against the overlap
  race condition** — even once the overlap check above exists, two
  concurrent requests could both pass it before either inserts. Fine for
  now (no concurrent load), worth a Postgres `EXCLUDE USING gist`
  constraint (`btree_gist` + a `daterange` column) if this ever matters.
- `update`/`remove` are still the generator's placeholder string returns,
  untouched.

## Verification

Manually exercised the full new surface via Swagger's "Try it out" (a real
request against the running dev server + real DB, not a mock) against
`bun run start:dev`: `POST /bookings` (confirmed a row lands in
`reservations`), `GET /bookings` (confirmed the `hotel`/`user` join
populates correctly), `GET /bookings/hotel/:hotelId` (confirmed
`check_out >= CURRENT_DATE` filtering and that `/bookings/hotel/...`
doesn't get shadowed by `:id`), `GET /bookings/:id`. Cross-checked against
`hotels-web-next` by regenerating `docs/openapi.json` and running that
repo's `generate:api-types`, then completing an actual booking through the
UI end-to-end (date range → submit → row in DB → redirect to
`/booking/:id`).
