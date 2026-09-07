# Booking creation — event and queue flow

Companion to [`docs/logs/005-queue-and-event-driven-bookings.md`](../logs/005-queue-and-event-driven-bookings.md).

When `POST /bookings` succeeds, three things are triggered from
`BookingsService.create()` and **none of them are awaited** before the HTTP
response goes out:

1. **Request path** (solid arrows) — controller → service → validation →
   `INSERT` → build `BookingCreatedEvent` → fire the three calls below →
   `return booking`. The `201` + `BookingDto` is sent at that `return`, before
   any of the async work has necessarily finished.
2. **Event path** (`EventEmitter2`) — in-process, fire-and-forget. `emit()`
   dispatches synchronously to `@OnEvent` handlers but does not wait for their
   async bodies. Lost if the process dies mid-dispatch — which is why only
   analytics (a log line) rides this path.
3. **Queue path** (Bull) — `queue.add()` writes a job to Redis and is
   `.catch()`-guarded so a Redis outage logs instead of throwing an unhandled
   rejection. Jobs persist in Redis, so `send-confirmation-email` /
   `generate-invoice` survive a restart and can be retried. The
   `EmailQueueProcessor` worker runs in the same process and picks jobs up off
   Redis independently of the request.

The event/queue split maps to one question: *does this work need to survive a
crash or retry?* Yes → Bull. No → the emitter.

```mermaid
flowchart TD
    client([POST /bookings])

    subgraph req["Request path — synchronous, holds the HTTP response"]
        direction TB
        ctrl["BookingsController.create"]
        svc["BookingsService.create"]
        validate["assertCheckInNotInPast<br/>assertNoOverlap"]
        insert["INSERT ... RETURNING *"]
        buildEvent["new BookingCreatedEvent<br/>{ bookingId, userId, hotelId, checkIn, checkOut }"]
        emit["eventEmitter.emit('booking.created', event)<br/><i>not awaited</i>"]
        add1["emailQueue.add('send-confirmation-email', event)<br/><i>not awaited &middot; .catch guarded</i>"]
        add2["emailQueue.add('generate-invoice', event)<br/><i>not awaited &middot; .catch guarded</i>"]
        ret["return booking"]
    end

    resp([HTTP 201 + BookingDto<br/>response sent here])

    subgraph evt["Event path — EventEmitter2, in-process, fire-and-forget (lost on crash)"]
        direction TB
        listener["BookingAnalyticsListener<br/>@OnEvent('booking.created')"]
        analytics["sleep 1s &middot; log ids<br/>no DB &middot; no email"]
    end

    subgraph queue["Queue path — Bull worker, jobs persisted in Redis, retryable"]
        direction TB
        proc["EmailQueueProcessor<br/>@Processor('email-queue')"]
        h1["@Process('send-confirmation-email')"]
        details["BookingNotificationService.getDetails(bookingId)"]
        selectJoin["SELECT ... JOIN hotels, users"]
        resendSvc["ResendEmailService<br/>.sendBookingConfirmationEmail"]
        h2["@Process('generate-invoice')"]
        invoice["generate invoice &middot; log"]
    end

    pg[("Postgres<br/>hotels table")]
    redis[("Redis")]
    resendApi{{"Resend API<br/>warn + skip if RESEND_API_KEY unset"}}

    client --> ctrl --> svc --> validate --> insert --> buildEvent
    insert <-->|"parameterized SQL"| pg
    buildEvent --> emit --> add1 --> add2 --> ret --> resp

    emit -. "dispatches in-process" .-> listener --> analytics

    add1 -. "enqueue job" .-> redis
    add2 -. "enqueue job" .-> redis
    redis -. "worker pulls job" .-> proc
    proc --> h1 --> details --> selectJoin --> resendSvc
    proc --> h2 --> invoice
    selectJoin -->|"reads"| pg
    resendSvc -->|"HTTPS"| resendApi

    classDef external fill:#f5f5f5,stroke:#999,color:#333;
    class pg,redis,resendApi external;
```

## App-level wiring behind the diagram

- `EventEmitterModule.forRoot()`, `QueueModule` (`@Global()`, owns the one Redis
  connection via `BullModule.forRootAsync`), and `QueueBoardModule` (Bull Board
  UI at `/queues`) are added in `src/app.module.ts`.
- `BookingsModule` registers the `email-queue` (`BullModule.registerQueue`) and
  adds `BookingNotificationService`, `ResendEmailService`,
  `BookingAnalyticsListener`, `EmailQueueProcessor` to `providers`.
- The queue name lives in its own file, `src/bookings/bookings.constants.ts`
  (`EMAIL_QUEUE = 'email-queue'`), to break a `bookings.module` ↔
  `bookings.service` import cycle.
