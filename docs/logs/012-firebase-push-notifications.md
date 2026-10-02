# Firebase push notifications on booking confirmation

Added a `booking_status` enum (`pending` / `confirmed` / `cancelled` /
`completed` / `no_show`) to `bookings`, defaulting new bookings to
`pending`, plus a `PATCH /bookings/:id/status` route to change it.

When a booking is set to `confirmed`, `BookingsService.updateStatus` sends
a real Firebase Cloud Messaging push (not the Expo relay — direct
`firebase-admin`) to the guest's registered device(s), fire-and-forget,
same pattern as the existing email/analytics side effects in `create()`.

## New pieces

- `migrations/1790605132324_add-status-to-bookings.sql` — the enum + column.
- `migrations/1790605132427_create-device-push-tokens-table.sql` —
  `device_push_tokens` (`user_id`, `token` unique, `platform`), since a
  user can have more than one device.
- `src/push-notifications/` — new module:
  - `push-tokens.service.ts` / `.controller.ts`: `POST /push-tokens`
    upserts a device token, keyed by `token` (`ON CONFLICT (token) DO
    UPDATE`) so re-registering a device after reinstall/token-refresh moves
    it to whichever user is current, rather than erroring on the unique
    constraint.
  - `firebase-push.service.ts`: wraps `firebase-admin`'s modular
    `getMessaging()`. Follows `ResendEmailService`'s pattern exactly —
    reads `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` /
    `FIREBASE_PRIVATE_KEY` from `ConfigService`, no-ops with a `Logger.warn`
    if any are missing (so local dev without Firebase creds doesn't throw).
    A dead token (`messaging/registration-token-not-registered` or
    `messaging/invalid-registration-token`) is deleted from
    `device_push_tokens` on send failure.

## Gotchas

- **`firebase-admin`'s modular API, not the namespaced one.** `import *
  as admin from 'firebase-admin'` doesn't expose `admin.messaging` /
  `admin.credential` / `admin.initializeApp` in this package version
  (v14) — `tsc` fails with "Namespace has no exported member". Use the
  submodule imports instead: `import { cert, getApp, getApps,
  initializeApp } from 'firebase-admin/app'` and `import { getMessaging }
  from 'firebase-admin/messaging'`.
- **`FIREBASE_PRIVATE_KEY` needs a `\n` → real-newline conversion at
  runtime** (`.replace(/\\n/g, '\n')`) — a PEM key can't contain literal
  newlines in a single-line `.env` value, so the downloaded service
  account JSON's `private_key` has to be pasted with `\n` escapes intact,
  and the code un-escapes it before calling `cert()`.
- No auth exists yet (same as the rest of this API — see `CLAUDE.md`), so
  neither `PATCH /bookings/:id/status` nor `POST /push-tokens` checks that
  the caller owns the resource. Both have a `TODO(auth)` comment marking
  this; anyone can currently confirm any booking or register a token
  against any `userId`. Fine for local/dev use via Swagger, not fine
  beyond that.
- Remember: `bun run generate:openapi` was run after the DTO/route
  changes (per the contract-first rule), and the sibling `hotels` repo's
  `bun run generate:api-types` needs re-running too whenever this repo's
  `docs/openapi.json` changes again.

## What's still missing (deliberately out of scope here)

- Real ownership/auth checks on both new endpoints.
- A host-side UI to actually trigger the status change (today it's
  Swagger-only, by design, for this dev exercise).
- Delivery receipts / retry handling beyond "delete on hard failure."
