# 004 — The `.toISOString()` pitfall on date-only columns

## The bug

`toBookingDto`/`toBookingDetailsDto` formatted `check_in`/`check_out` with
`row.check_in.toISOString().slice(0, 10)`. On a server whose local
timezone is ahead of UTC (this machine: `Europe/Warsaw`, UTC+2), a booking
created with `checkIn: "2026-10-11"` came back from the API as
`"2026-10-10"` — one day earlier than what was stored.

## Why it happens

`check_in`/`check_out` are Postgres `date` columns — no time-of-day, no
timezone, just a calendar day. node-pg's default parser for `date` builds
a JS `Date` via `new Date(year, month, day)`, which the language always
interprets as **local midnight**. So far so good — the `Date` object
correctly represents "Oct 11" as understood by the server's local clock.

The break happens at `.toISOString()`: it doesn't know or care that the
value started life as a bare calendar day — it always renders the
instant's UTC equivalent. Local midnight Oct 11 in Warsaw (UTC+2) is
`2026-10-10T22:00:00.000Z`. `.slice(0, 10)` then reads off `"2026-10-10"`.
The date was never wrong in memory; it was only misread on the way out.

## The fix

Added `formatDateOnly()`, which reads the same `Date` object back with
`getFullYear()` / `getMonth()` / `getDate()` — the local-timezone getters,
matching how node-pg constructed it — instead of routing through UTC at
all:

```ts
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

Also applied it to `assertCheckInNotInPast`'s notion of "today"
(previously `new Date().toISOString().slice(0, 10)`, same class of bug in
the opposite direction: for the first couple of hours after local
midnight, UTC's calendar date still lags a day behind, so "today" would
resolve to yesterday and let an already-past `checkIn` through).

## The general rule going forward

Any time `.toISOString()` (or anything else that's UTC-flavored) touches
a value that came from — or is meant to represent — a bare calendar date
with no attached time-of-day, that's a sign the code is treating "which
day" as "which instant." Those aren't the same thing, and the conversion
between them is exactly where the day can shift. Reach for local-timezone
`Date` getters (or, for values already in `YYYY-MM-DD` string form,
compare/format them as plain strings — lexical ordering matches
chronological ordering for that format) instead of bouncing through UTC.
