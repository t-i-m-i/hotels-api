# Booking status

Statuses live in `src/bookings/booking-status.enum.ts`; the rules below live in
`src/bookings/booking-status-transitions.ts` and are enforced in
`BookingsService.updateStatus` (`PATCH /bookings/:id/status`, requires a session).

## Who can do what

The caller is the **host** if they own the booking's hotel (`hotels.owner_id`) and the
**guest** if they made the booking (`bookings.user_id`). Someone who is neither gets 403.
(A host booking their own hotel is both, and gets the union of both rows.)

| From        | Guest may set | Host may set               |
| ----------- | ------------- | -------------------------- |
| `pending`   | `cancelled`   | `confirmed`, `cancelled`   |
| `confirmed` | `cancelled`   | `cancelled`, `no_show`     |
| `cancelled` | —             | —                          |
| `no_show`   | —             | —                          |
| `completed` | —             | —                          |

Extra rule: `no_show` is only accepted on or after the booking's `check_in` date.

## `allowedStatusChanges`

Booking list responses tell the client what it may do, so the app needs no date or
role logic. `HostBookingDto` (`GET /bookings/host/:hostId`, always the `host` row)
and `BookingDetailsDto` (`GET /bookings/user/:userId`, the `guest` row, or `host` if
the user owns the hotel) carry `allowedStatusChanges: BookingStatus[]`.

It comes from `getAllowedStatusChanges` in `booking-status-transitions.ts`, the same
function `updateStatus` uses for its 409 check: the table above, minus `no_show`
before check-in, and empty once `check_out` has passed (so a `pending` booking left
past its dates can no longer be confirmed or cancelled). The 403 check still uses
the full table. The list is a UI hint only; `PATCH /bookings/:id/status` stays the
authority, and a list that went stale (e.g. across midnight) just yields a 409.

Errors:

- **403** — the caller can never set that status (e.g. a guest confirming, anyone
  setting `completed`), or isn't part of the booking.
- **409** — the status is fine for that role but not from the booking's current state
  (e.g. cancelling a `no_show`, `no_show` before check-in, any change to a `pending`
  booking past its `check_out`, or the status changed
  concurrently — the `UPDATE` is guarded with `AND status = <expected>`).

## `completed` is derived, not stored

No cron and no endpoint sets `completed`. Instead every read computes it:
a stored `confirmed` booking whose `check_out` is before today is returned as
`completed` (`effectiveStatusSql` in the transitions file, used by `findAll`,
`findOne`, `getBookingsByUser` and `getByHost`). The `status` column keeps saying
`confirmed`.

Consequences:

- Always correct the moment the date passes; nothing to run or miss.
- `updateStatus` validates against the effective status, so a past confirmed booking
  can no longer be cancelled or marked no-show (a host who needs `no_show` must do it
  on or before check-out day).
- Anything that queries `bookings.status` directly in SQL (reports, filters) must use
  `effectiveStatusSql` too, or it will see `confirmed`.
- Only `confirmed` bookings become `completed`; a `pending` booking left past its
  dates stays `pending`.
- "Today" is the database's `CURRENT_DATE` (server timezone), same as
  `findCurrentByHotel`.
