# 005 — Wiring up Bull queues and EventEmitter2 around booking creation

## Packages added

| Package | What it's for |
|---|---|
| `@nestjs/bull` | Nest's wrapper around `bull` — gives us `BullModule.forRootAsync`/`registerQueue`, `@InjectQueue`, `@Processor`/`@Process` decorators. |
| `bull` | The actual job-queue library (Redis-backed). Classic Bull (v4), not BullMQ — see "Why classic Bull, not BullMQ" below. |
| `@nestjs/event-emitter` | Nest's wrapper around `eventemitter2` — gives us `EventEmitterModule.forRoot()`, `@OnEvent`, and an injectable `EventEmitter2`. |
| `resend` | Official Resend SDK — used by `ResendEmailService` to actually send the booking-confirmation email. |
| `@bull-board/api`, `@bull-board/express`, `@bull-board/nestjs` | Queue monitoring UI (Bull Board), mounted at `/queues`, so queued/active/completed jobs are visible without inspecting Redis directly. |

`bull` pulls in `ioredis` transitively; there's no separate `ioredis`
dependency in `package.json`.

### Why classic Bull, not BullMQ

`@nestjs/bullmq` (the newer wrapper) uses a `WorkerHost` class with a
single `process(job)` method per queue — one handler, dispatching on
`job.name` yourself if you need more than one job type. Classic
`@nestjs/bull` instead gives a `@Processor()` class with one `@Process
('job-name')` method per job type. Since this queue handles two distinctly
different jobs (`send-confirmation-email`, `generate-invoice`), the
classic per-method decorator shape maps onto that split directly, so we
went with `@nestjs/bull` + `bull`.

## Jest config gotcha: ESM-only transitive deps

`@nestjs/bull`, `@nestjs/bull-shared`, `@nestjs/event-emitter`, and
`eventemitter2` ship as native ESM (`export {...} from ...` in their
compiled output). Jest's default config only transforms first-party
source, not `node_modules`, so any spec file importing from those
packages failed with `SyntaxError: Unexpected token 'export'`. Fixed by
widening `transformIgnorePatterns` in `package.json`'s `jest` block to let
ts-jest transform those four packages instead of skipping them:

```json
"transformIgnorePatterns": [
  "node_modules/(?!(@nestjs/bull|@nestjs/bull-shared|@nestjs/event-emitter|eventemitter2)/)"
]
```

## Step 1 — Redis and env

`docker-compose.yml` (new, repo had none before) defines a single `redis`
service (`redis:7-alpine`, port 6379, a named volume, a `redis-cli ping`
healthcheck). `.env.example` gained `REDIS_URL` (consumed by
`QueueModule`, below) and `RESEND_API_KEY` (consumed by
`ResendEmailService`, optional — see "Graceful degradation" below).

## Step 2 — `QueueModule`: the Redis connection, once, globally

`src/queue/queue.module.ts` is `@Global()`, mirroring
`src/db/database.module.ts`'s shape: a factory-provider approach, reading
config via `ConfigService` instead of hardcoding a connection string. The
difference from `DatabaseModule` is that there's no manual `Pool`
construction here — `BullModule.forRootAsync`'s `useFactory` just returns
connection options (`{ url: REDIS_URL }`), and Bull/`ioredis` own the
actual connection lifecycle internally:

```ts
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ url: config.get<string>('REDIS_URL') }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

Because this is global and exports `BullModule`, any feature module can
later call `BullModule.registerQueue({ name: '...' })` to declare a queue
against this one shared connection — no need to redeclare `forRootAsync`
per feature.

## Step 3 — `QueueBoardModule`: monitoring UI

`src/queue/bull-board.module.ts` mounts Bull Board at `/queues`. It
registers the same `email-queue` (see step 4) a second time via
`BullModule.registerQueue` purely so Bull Board's `forFeature` can attach
to it — Nest/Bull dedupe same-named queue registrations against the same
Redis connection rather than opening two separate queues, so this doesn't
create anything extra, it's just how Bull Board's DI wiring expects to be
handed a queue reference.

## Step 4 — App-level wiring

`src/app.module.ts` adds three imports: `EventEmitterModule.forRoot()`
(the only setup EventEmitter2 needs — no config, so import order relative
to `ConfigModule` doesn't matter), `QueueModule`, and `QueueBoardModule`.

## Step 5 — `bookings.constants.ts`: the queue name

`src/bookings/bookings.constants.ts` exports `EMAIL_QUEUE = 'email-queue'`
as its own file specifically to avoid a circular import: the queue name
is needed by both `bookings.module.ts` (to register the queue) and
`bookings.service.ts` (to `@InjectQueue` it) — putting the constant in
either of those two files would make the other import from it, creating a
module ↔ service cycle.

## Step 6 — `BookingsModule`: registering the queue and new providers

`src/bookings/bookings.module.ts` is the first feature module in the repo
to need an `imports` array (`HotelsModule`/the old `BookingsModule` only
had `controllers`/`providers`) — `BullModule.registerQueue({ name:
EMAIL_QUEUE })` requires it. `providers` grew to include every new class
below (`BookingNotificationService`, `ResendEmailService`,
`BookingAnalyticsListener`, `EmailQueueProcessor`) so Nest's DI container
can construct and inject them.

## Step 7 — the "submodules": events, listeners, processors

Three new directories under `src/bookings/`, each with one job:

**`events/booking-created.event.ts`** — a plain class, not a DTO (no
`@ApiProperty`, never touches a controller or `docs/openapi.json`),
carrying just `bookingId`, `userId`, `hotelId`, `checkIn`, `checkOut`.
This single shape is reused as both the `EventEmitter2` payload *and* the
Bull job payload — one type, two delivery mechanisms.

**`listeners/booking-analytics.listener.ts`** — one `@OnEvent
('booking.created')` handler. This is the only thing subscribed to the
event; it does not touch email or invoices, and doesn't hit the database
at all — it just sleeps 1s and logs the ids already present on the event
payload.

**`processors/email-queue.processor.ts`** — a `@Processor(EMAIL_QUEUE)`
class with two `@Process(...)` handlers, `send-confirmation-email` and
`generate-invoice`, one queue carrying two distinct job types
distinguished by name. This is where the "real work" lives.

## Step 8 — why analytics and email/invoice are split across the two mechanisms

Early in planning, both an `@OnEvent` listener *and* a `@Process
('send-confirmation-email')` handler were going to call Resend — which
means every booking would send two confirmation emails. Instead, the
event/queue split now maps to a "does this need to survive a crash or
retry" question: `EventEmitter2` is fire-and-forget, in-process, and lost
if the process dies mid-dispatch — fine for analytics logging, not fine
for "did the customer get their email." Bull persists jobs to Redis, so
`generate-invoice`/`send-confirmation-email` survive a restart and can be
retried; the emitter is left to the one job (analytics) where that
durability doesn't matter.

## Step 9 — data the event doesn't carry: `BookingNotificationService`

`BookingCreatedEvent` only has ids and dates — enough for the analytics
listener, not enough for a real email (needs the hotel's name and the
user's name/email). Rather than growing the event payload with a join the
`create()` insert path doesn't otherwise need, `src/bookings/booking-
notification.service.ts` is a small dedicated service with one method,
`getDetails(bookingId)`, doing the same `hotels`/`users` join query
`BookingsService.findAll()` already uses, and follows the same
`/*sql*/`-tagged-query + `*Row`-type + mapper convention as the rest of
the codebase. Called from `EmailQueueProcessor.handleSendConfirmationEmail`
right before the Resend call — i.e., the extra `SELECT` happens on the
async worker path, off the request/response critical path.

## Step 10 — `ResendEmailService` and graceful degradation

`src/bookings/resend-email.service.ts` wraps the `resend` SDK. The `from`
address is Resend's sandbox sender (`onboarding@resend.dev`) — a real
send would otherwise fail without a verified domain. If `RESEND_API_KEY`
is unset, the constructor leaves `this.resend` as `null` and
`sendBookingConfirmationEmail` logs a `warn` and returns instead of
throwing — the whole flow (booking creation, the queue job, the other
listener) still completes normally, verified locally with no key set.

## Step 11 — `BookingsService.create()`: where it all gets triggered

After the existing `INSERT ... RETURNING *` and `toBookingDto` mapping,
three new constructor dependencies get used —
`@InjectQueue(EMAIL_QUEUE) emailQueue: Queue` and `eventEmitter:
EventEmitter2` (added alongside the existing `@Inject(PG_POOL) pool`):

```ts
const event = new BookingCreatedEvent(
  booking.id, booking.userId, booking.hotelId, booking.checkIn, booking.checkOut,
);

this.eventEmitter.emit('booking.created', event);
this.emailQueue.add('send-confirmation-email', event).catch((err) => console.error(...));
this.emailQueue.add('generate-invoice', event).catch((err) => console.error(...));

return booking;
```

None of these three calls are awaited before `return booking`. `emit()`
dispatches synchronously to `@OnEvent` handlers but doesn't wait for their
(async) bodies to finish; `queue.add()` returns a promise that resolves
once Bull's Redis write completes, which is fast but still async — left
un-awaited and `.catch()`-guarded so a Redis outage logs an error instead
of producing an unhandled rejection, without blocking the HTTP response
either way.

## Step 12 — request-time trace

1. `POST /bookings` hits `BookingsController.create` → `BookingsService
   .create()`.
2. Existing validation (`assertCheckInNotInPast`, `assertNoOverlap`) and
   the `INSERT` run exactly as before this change.
3. `BookingCreatedEvent` is built from the inserted row.
4. `eventEmitter.emit('booking.created', event)` — dispatches to
   `BookingAnalyticsListener.handleBookingCreated` in-process.
5. `emailQueue.add('send-confirmation-email', event)` and `emailQueue.add
   ('generate-invoice', event)` — two jobs land in Redis.
6. `return booking` — the HTTP response goes out here, before any of the
   above has necessarily finished.
7. Independently, `EmailQueueProcessor` (a Bull worker running in the same
   process) picks up both jobs off Redis and runs them.
