# 015 — Booking status transition guards

- `PATCH /bookings/:id/status` now requires a session and enforces per-role
  transitions (guest vs host), see `docs/guides/booking-status.md`.
- `completed` is derived in SQL on read (confirmed + past `check_out`) instead of
  by a cron; it cannot be set through the API.
- `no_show` is host-only, from `confirmed`, on/after check-in.
- New `src/bookings/booking-status-transitions.ts`; service tests added;
  `docs/openapi.json` regenerated (new 403/409 responses).
