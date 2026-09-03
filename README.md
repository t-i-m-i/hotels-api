# Hotels API

## 1. What this is

The backend for the [Hotels app](https://github.com/t-i-m-i/hotels) — a small NestJS REST API that
serves hotel listing data. It's the server-side half of a demo project
showing a type-safe API contract shared between a NestJS backend and an
Expo/React Native client via a generated OpenAPI spec.

This is a demo, not production infrastructure:

- **No authentication.** There's currently no login/session/token system.
  Nothing in the API is gated.

What it does provide, deliberately:

- **A public API contract.** All routes are backed by explicit DTOs
  (`HotelDto`, `GeoDto`, `ListHotelsQueryDto`, `BookingDto`, and friends)
  with `@nestjs/swagger` decorators — no internal data shape ever leaks
  into a response; the DTOs *are* the contract.
- **A generated OpenAPI spec** (`docs/openapi.json`, committed) that the
  Expo app's `openapi-typescript` codegen consumes directly, so both sides
  of the API boundary share real, generated TypeScript types instead of
  hand-kept-in-sync interfaces.
- **Request validation** via `class-validator` + a global `ValidationPipe`.
- **A shared Postgres database.** `HotelsService` queries the same Neon
  Postgres `hotels` table that [`hotels-alt-api`](https://github.com/t-i-m-i/hotels-alt-api)
  reads from — both APIs serve the same underlying data over different
  frameworks/contracts. Connect via `DATABASE_URL` in `.env`.
- **Events and background jobs.** Creating a booking emits an internal
  event and enqueues Redis-backed jobs, so slower work happens off the
  request path. Local dev needs Redis (`REDIS_URL`); a queue dashboard is
  served at `http://localhost:3000/queues`.

## 2. Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/hotels` | List hotels. Optional `?search=` filters by name/location. |
| `GET` | `/hotels/:id` | Fetch a single hotel, `404` if the id doesn't exist. |
| `POST` | `/bookings` | Create a booking. |
| `GET` | `/bookings` | List all bookings, with hotel and user details. |
| `GET` | `/bookings/hotel/:hotelId` | Current bookings for a hotel. |
| `GET` | `/bookings/user/:userId` | Bookings for a user, with details. |
| `GET` | `/bookings/:id` | Fetch a single booking, `404` if the id doesn't exist. |
| `PATCH` | `/bookings/:id` | Update a booking. |
| `DELETE` | `/bookings/:id` | Delete a booking. |

## 3. Running it locally

Requires [bun](https://bun.sh) and a local Redis for the job queues.

```bash
bun install
cp .env.example .env   # set DATABASE_URL; REDIS_URL points at localhost by default
bun run start:dev
```

The server starts on `http://localhost:3000` (or `$PORT`). Interactive
Swagger docs are served at `http://localhost:3000/api`, and the queue
dashboard at `http://localhost:3000/queues`.

### Scripts

| Command | What it does |
|---|---|
| `bun run start:dev` | Start the dev server with watch mode. |
| `bun run build` | Compile to `dist/`. |
| `bun run start:prod` | Run the compiled build (`node dist/main`). |
| `bun run generate:openapi` | Regenerate `docs/openapi.json` from the current controllers/DTOs — run this after changing any route or DTO shape, then re-run `bun run generate:api-types` in the Expo app to pick up the new types. |
| `bun run lint` | ESLint. |
| `bun run test` | Unit tests (Jest). |

## 4. Working alongside the Expo app

The two repos are meant to be checked out as siblings
(`hotels/` and `hotels-api/` next to each other) — the Expo app's
type-generation script reads this repo's `docs/openapi.json` via a
relative path, no running server required for that step. For actually
*using* the API from the app, though, this server does need to be running
locally (`bun run start:dev`) — start it in its own terminal tab/pane and
leave it running while you work on the Expo side.

See `docs/logs/` for the running history of how this was built and why,
and `docs/README.md` for the log convention.
