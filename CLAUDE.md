# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The backend for the [Hotels app](https://github.com/t-i-m-i/hotels) — a small NestJS REST API serving
hotel listing data. It's the server-side half of a demo project showing a type-safe API contract shared
between this NestJS backend and an Expo/React Native client via a generated OpenAPI spec.

This is a demo, not production infrastructure:

- **No authentication** — nothing is gated.
- **No real database** — `HotelsService` serves a small in-memory mock array. `DATABASE_URL` exists in
  `.env.example` as a documented seam for wiring up a real database later; nothing reads it yet.

What it does provide deliberately:

- **A public API contract**: every route is backed by explicit DTOs (`HotelDto`, `GeoDto`,
  `ListHotelsQueryDto`) with `@nestjs/swagger` decorators — no internal data shape ever leaks into a
  response; the DTOs *are* the contract.
- **A generated OpenAPI spec** (`docs/openapi.json`, committed) that the Expo app's `openapi-typescript`
  codegen consumes directly, so both sides of the API boundary share generated TypeScript types instead
  of hand-kept-in-sync interfaces.
- **Request validation** via `class-validator` + a global `ValidationPipe` (`whitelist: true, transform: true`).

## Commands

Package manager is **bun** (`bun.lock` is committed — don't introduce npm/yarn lockfiles).

```bash
bun install
cp .env.example .env        # only PORT and a placeholder DATABASE_URL today
bun run start:dev           # dev server with watch mode, http://localhost:3000
```

| Command | What it does |
|---|---|
| `bun run start:dev` | Start the dev server with watch mode. |
| `bun run build` | Compile to `dist/`. |
| `bun run start:prod` | Run the compiled build (`node dist/main`). |
| `bun run generate:openapi` | Regenerate `docs/openapi.json` from the current controllers/DTOs. **Run this after changing any route or DTO shape**, then re-run `bun run generate:api-types` in the sibling Expo app to pick up the new types. |
| `bun run lint` | ESLint (`--fix`). |
| `bun run format` | Prettier over `src/**/*.ts` and `test/**/*.ts`. |
| `bun run test` | Unit tests (Jest, config lives in `package.json`'s `jest` key, rootDir `src`). |
| `bun run test:watch` | Jest watch mode. |
| `bun run test:cov` | Jest with coverage. |
| `bun run test:e2e` | E2E tests (`test/jest-e2e.json`). |

To run a single unit test: `bun run test <path-or-name-fragment>` (Jest's normal filtering) or
`bun run test -- -t '<test name>'`.

Interactive Swagger docs are served at `http://localhost:3000/api` when the dev server is running.

## Architecture

Standard NestJS module structure — one feature module per resource, each with `*.module.ts`,
`*.controller.ts`, `*.service.ts`, and a `dto/` folder:

- `src/app.module.ts` — root module; wires up global `ConfigModule` and feature modules (currently just
  `HotelsModule`).
- `src/main.ts` — bootstraps the app for normal serving: enables CORS, registers the global
  `ValidationPipe`, builds the Swagger document via `buildOpenApiDocument()` and mounts it at `/api`.
- `src/openapi-document.ts` — the single source of truth for the `DocumentBuilder` config (title,
  description, version). Shared between `main.ts` (live Swagger UI) and `generate-openapi.ts` (static
  spec generation) so the two never drift.
- `src/generate-openapi.ts` — standalone script (`bun run generate:openapi`) that boots a headless Nest
  app, builds the same OpenAPI document, and writes it to `docs/openapi.json`. This file is committed and
  consumed by the Expo app's codegen — treat route/DTO changes as breaking this contract until
  regenerated.
- `src/hotels/` — the one feature module today. `HotelsService` holds the mock data and lookup/filter
  logic; `HotelsController` is a thin layer that maps query/path params to service calls and declares
  response shapes via `@ApiOkResponse`/`@ApiNotFoundResponse`. `NotFoundException` in the service becomes
  the 404 documented on the controller.

**Contract-first discipline**: because `docs/openapi.json` is consumed by a separate repo, any change to
a controller route signature or DTO field must be followed by `bun run generate:openapi` in the same
change. DTOs are the only thing allowed to shape a response — never return a raw internal type from a
controller.

## Working alongside the Expo app

The two repos are meant to be checked out as siblings (`hotels/` and `hotels-api/` next to each other) —
the Expo app's type-generation script reads this repo's `docs/openapi.json` via a relative path, no
running server required for that step. For actually *using* the API from the app, this server needs to
be running locally (`bun run start:dev`) in its own terminal while working on the Expo side.

## Docs conventions (`docs/`)

- Top-level `.md` files in `docs/` are reference docs describing the *current* state of the project
  (architecture, decisions, how-tos) — edited in place as things change.
- `docs/logs/` is a dated, append-only log of work sessions (`logs/NNN-short-topic.md`, zero-padded,
  incrementing). Logs are never edited after the fact — corrections go in a newer log entry or a
  top-level reference doc instead.
- `docs/openapi.json` is generated output, not a reference doc.
