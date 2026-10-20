# Hotels API

**NestJS REST API** that serves hotels and bookings data for:

- [Hotels mobile - React Native with Expo](https://github.com/t-i-m-i/hotels)
- [Hotels web - Next.js](https://github.com/t-i-m-i/hotels-web-next)

<img width="1200" height="667" alt="Image" src="https://github.com/user-attachments/assets/a889b15e-be91-46c2-a60f-47cfc9f902f3" />

## What it provides

- **Public API contract.** All routes are backed by explicit DTOs
  with `@nestjs/swagger` decorators. The full list of routes
  lives in the Swagger docs at `http://localhost:3000/api`
- **Generated OpenAPI spec** (`docs/openapi.json`, committed) that the
  Expo and Next.js app's `openapi-typescript` codegen consumes directly, so both sides of the API boundary share real, generated TypeScript types instead of hand-kept-in-sync interfaces.
- **Request validation** via `class-validator` + a global `ValidationPipe`.
- **PostgreSQL database.**
- **Events and background jobs.** Creating a booking emits an internal
  event and enqueues Redis-backed jobs, so slower work happens off the
  request path. Local dev needs Redis (`REDIS_URL`); a queue dashboard is
  served at `http://localhost:3000/queues`.
- **Authentication** powered by [Better Auth](https://www.better-auth.com)

## Running it locally

Requires [bun](https://bun.sh) and a local Redis (`docker compose up -d redis`) for the job queues, and a PostgreSQL database with the PostGIS extension.

```bash
bun install
# set DATABASE_URL; REDIS_URL points at localhost by default
cp .env.example .env
# Regenerate `docs/openapi.json` from the current controllers/DTOs.
# Run this after changing any route or DTO shape,
# then re-run `bun run generate:api-types` in the Expo and Next.js app
# to pick up the new types.
bun run generate:openapi
# Apply all SQL migrations in `migrations/` to the database in DATABASE_URL
# (also enables PostGIS, so the database user needs permission to create extensions)
bun run migrate:up
bun run start:dev
```

The server starts on `http://localhost:3000` (or `$PORT`). Interactive
Swagger docs are served at `http://localhost:3000/api`, and the queue
dashboard at `http://localhost:3000/queues`.

## Testing

| Command              | What it does                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `bun run test`       | Unit tests (Jest).                                                                                                                   |
| `bun run test:watch` | Unit tests in watch mode.                                                                                                            |
| `bun run test:cov`   | Unit tests with coverage.                                                                                                            |
| `bun run test:e2e`   | E2E tests (Jest + Supertest) (`test/*.e2e-spec.ts`). Boots the real `AppModule` against whatever `DATABASE_URL` points to. No mocks. |

`bun run test:e2e` needs a reachable database with the demo seed data
(same `DATABASE_URL` as `bun run start:dev`) and Redis up, since booting
`AppModule` wires up the Bull queues too.

### Synthetic bookings, for the sibling apps' e2e suites

`hotels-web-next`'s Playwright suite and the `hotels` RN app's Maestro
flow both create a real booking against this same database as part of
their happy-path e2e tests. Rather than have them find-and-delete that
booking by guessing at hotel name/dates, `POST /bookings` accepts an
optional `X-Synthetic-Booking: true` header, persisted as
`bookings.is_synthetic`, and `DELETE /bookings/synthetic` removes every
row tagged that way in one call. See
`docs/guides/testing-against-production-patterns.md` for how this
compares to how production systems (Stripe test mode, disposable
per-run environments, etc.) handle the same problem, and
`docs/logs/007-synthetic-booking-tag.md` for how this was added.

## About me

Hi, I'm Tymoteusz. I'm a Fullstack Developer working across frontend, backend, and user experience. I build native mobile apps, backend APIs, and work with databases. I'm looking for an opportunity to keep growing as a Software Engineer - Fullstack Node.js React and/or React Native.
