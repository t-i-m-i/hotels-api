# 016 — `allowedStatusChanges` on booking DTOs

- `HostBookingDto` and `BookingDetailsDto` now include `allowedStatusChanges`, so
  clients render status buttons from it instead of re-deriving role/date rules.
- New `getAllowedStatusChanges` in `booking-status-transitions.ts` (plain
  `YYYY-MM-DD` strings, `today` passed in); `updateStatus` uses it for the 409
  check, replacing the inline `no_show` date check. The 403 check is unchanged.
- Behaviour change: a `pending` booking past its `check_out` has no allowed
  changes (previously the API still let the host confirm/cancel it).
- Removed the unused `findAll` service method and its commented-out route.
- Tests: `booking-status-transitions.spec.ts`; `getByHost` spec pins the clock.
- `docs/openapi.json` regenerated. The diff also picks up `guest*` fields on the
  create-booking DTO that were missing from the committed spec.
