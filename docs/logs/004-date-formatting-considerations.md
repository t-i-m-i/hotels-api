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

---

## `timestamp with time zone` vs `timestamp` for `created_at`/`updated_at`

`timestamptz` stores a genuine **absolute instant**: on write, Postgres converts whatever you give it to UTC internally; on read, it converts to the session's timezone setting. So `created_at` always represents "this exact moment in universal time," and comparisons/sorts/subtractions between rows are always correct — no matter what timezone the writing client, reading client, or the DB session itself happens to be configured as.

Plain `timestamp` stores whatever wall-clock value you hand it, **with the timezone silently discarded**. Postgres never converts it on the way in or out — it's just numbers, no timezone metadata. The danger: if your app server, your DB session, and your reporting tool all assume different timezones (or one of them changes config, or you deploy across regions), the *same stored value* gets reinterpreted differently by whoever reads it, with no way to tell it was wrong. Two events "5 minutes apart" recorded from processes in different timezones could even look 65 minutes apart in the raw data.

Rule of thumb: **timestamptz for anything that represents a real moment something happened** (created_at, updated_at, "booking was placed at"). Contrast with our `check_in`/`check_out` columns, which are intentionally plain `date` — not because we forgot the timezone, but because a check-in day genuinely *has no time-of-day or timezone component* as a business concept. That's the bridge into your third question.

## How real booking systems actually handle this

Your intuition is right, and it's the key insight: **a check-in date is not an instant in time — it's a calendar day, and specifically it's a calendar day in the hotel's location, not the booker's.**

When you're in Warsaw booking a hotel in Tokyo and pick "check-in: 1 September," that means September 1st as experienced in Tokyo. Nothing about your own timezone should factor into that value at all — the date picker just captures "the day the guest intends to check in," full stop. This is exactly why storing it as a plain `date` (no time, no zone) is the *correct* modeling choice, not a shortcut: there is no instant to represent, so attaching a timezone to it would be actively wrong — it would force an arbitrary answer to "check-in at what time, in what zone?" when the business concept doesn't have one.

Where timezones genuinely do enter a real booking system, and how each is handled:

- **"Check-in starts at 3pm"** — this is a real wall-clock policy, but it's *hotel-local* wall-clock, not UTC. Serious systems store the hotel's IANA timezone name (e.g. `"Asia/Tokyo"`, not a fixed UTC offset — offsets shift with daylight saving, named zones encode the actual rule) alongside a plain local time like `"15:00"`. "3pm" means 3pm at the hotel on whatever date, regardless of DST changes that might happen between booking and arrival.
- **`created_at` / `payment_captured_at` / audit trails** — these *are* real instants (a specific click, a specific charge), so `timestamptz`/UTC, exactly like your question 2. Displayed to a user, they get converted at render time to whichever timezone is relevant to the viewer (the guest's own clock, or hotel staff's local clock in their dashboard) — the stored value never changes, only the *display* is timezone-aware.
- **"Free cancellation until 24h before check-in"** — this is the genuinely tricky case, because it needs to combine a date-only value (check-in day) with the hotel's local check-in time and timezone to produce an actual instant ("2026-09-01 15:00 Asia/Tokyo" → converted to UTC), which is then what gets compared against "now." This is where naive code often reintroduces exactly the bug we just fixed — treating a date-only value as if it were a UTC instant.

So the mental model: **dates stay naked (no zone) when they describe a day with no attached instant; timezone-aware timestamps are reserved for things that actually happened at a specific moment.** The bug you saw was `toBookingDto` accidentally forcing a date-only value through a UTC-instant code path (`toISOString()`), manufacturing a false instant out of a value that was never supposed to have one. That's the general failure mode to watch for: any time `.toISOString()` (or anything UTC-flavored) touches a value that came from a `date` column, that's a sign the code is treating "which day" as "which moment," which they're not the same thing.
