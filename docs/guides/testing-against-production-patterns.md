# How real systems e2e-test write paths (orders, bookings, tickets)

Any e2e suite that exercises a "place an order" / "make a booking" / "buy a
ticket" journey has to answer the same question: does the test create a
*real* row against real infrastructure, and if so, how does it get cleaned
up? Real systems mostly avoid making that choice as directly as it first
appears — they don't test against production data at all, or they make the
test data self-identifying so cleanup stops being a matching problem.
Roughly in order of how much of the real stack they exercise:

## 1. Sandbox/test-mode environments

The most common pattern for payments and travel. Stripe, PayPal, most
flight/hotel GDS APIs (Amadeus, Sabre) ship a parallel "test mode" — same
API, same code paths, but writes go to a sandbox database, and magic test
values trigger specific outcomes (Stripe's `4242...` card always succeeds,
`4000...0002` always declines). Nothing needs cleanup because the sandbox
is either wiped periodically or was never real in the first place. This is
why e2e suites for checkout flows can safely "place real orders" all day —
they're real *in the sandbox*, fake everywhere else.

## 2. A dedicated, disposable environment per test run

Ephemeral staging environments (Vercel preview envs, a Postgres/Docker
stack spun up and torn down per CI run) mean "cleanup" is just "delete the
environment." No selective row deletion, no risk of matching the wrong
record — the whole database is thrown away. This is the scalable version
of tagging synthetic data in a shared environment (below), trading a
shared-state risk for the cost/latency of provisioning an environment per
run.

## 3. Tagged synthetic identities in a shared environment

When a fresh database per run is impractical — a small team, a shared demo
instance, or just not worth the CI latency — the fix isn't cleverer
matching logic against existing fields (hotel name, dates, SKU). It's
making the test data self-identifying *at creation time*: a fixed
synthetic user (`e2e-test@example.com`), a reserved test SKU/hotel/route,
or a marker field (`is_synthetic: true`) written on the row itself.
Cleanup becomes `DELETE WHERE is_synthetic = true` — trivially correct,
safe to run in bulk, and a periodic sweep job handles anything a crashed
run left behind, with no matching-by-coincidence risk.

This repo does exactly this for bookings: `POST /bookings` accepts an
`X-Synthetic-Booking: true` header, persisted as `bookings.is_synthetic`,
cleaned up in bulk via `DELETE /bookings/synthetic`
(`src/bookings/bookings.controller.ts`,
`docs/logs/007-synthetic-booking-tag.md`). It's a header rather than a
`CreateBookingDto` field deliberately — it's metadata about *who's
asking* (an e2e suite vs. a real client), not part of the booking itself,
so the public contract real client apps generate types from never gains a
field they could accidentally set.

## 4. Real transactions in production, immediately reversed

For the parts that can't be sandboxed at all — a live payment processor's
actual production endpoint, an airline's live seat inventory — some
companies genuinely place real orders in production on a schedule
("synthetic monitoring" / "canary transactions"), then immediately
void/refund/cancel via the same API. E-commerce sites often keep a
fixed-price test SKU (a $0.01 product that exists only for monitoring) so
the financial blast radius stays bounded even if the reversal step fails.

## 5. Idempotency + compensating actions as first-class API surface

Mature systems design the write path so "undo" is a supported, audited
operation, not a testing hack bolted on afterward: `POST /orders` returns
an id, `DELETE /orders/:id` (or a `cancel` state transition) exists for
real product reasons and e2e cleanup reuses it, rather than inventing a
second, test-only way to remove data. `BookingsService.remove()` in this
repo is exactly that reused surface — it exists because bookings need to
be cancellable, and the Playwright/Maestro suites in the sibling repos
call it (or the bulk `/bookings/synthetic` variant) instead of anything
test-specific.

## Choosing between these for a given system

Patterns 1–2 are strictly better when available — they remove the
question entirely instead of managing it. Pattern 3 (tagging) is the
right default for a shared, always-on environment where a full sandbox or
disposable-per-run setup isn't worth building yet, which is why it's what
this repo and its sibling e2e suites (`hotels-web-next`'s Playwright
suite, the `hotels` RN app's Maestro flow) use today. Pattern 4 only makes
sense when there's genuinely no sandbox to fall back on. Pattern 5 isn't
really a separate choice — it's the API design that makes whichever of 1–4
you pick tractable in the first place.
