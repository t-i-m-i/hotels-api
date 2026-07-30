# 002 — Hotels module, OpenAPI generation, and the public-contract boundary

## What we did

Built the actual API surface on top of the scaffold from 001: a single
`HotelsModule` serving the 5 hotels that used to live as a static array in
the Expo app (`src/data/mockHotels.ts` there), now server-side.

```
src/hotels/
  hotels.module.ts
  hotels.controller.ts    # GET /hotels?search=, GET /hotels/:id
  hotels.service.ts        # in-memory mock array + find/filter logic
  dto/
    hotel.dto.ts            # HotelDto + nested GeoDto
    list-hotels-query.dto.ts # ListHotelsQueryDto { search?: string }
```

The mock data is byte-for-byte the same 5 hotels (same ids, same
descriptions, same coordinates) — this was a data *migration*, not a
rewrite. Ids stayed strings (`"1"`–`"5"`) to match what the frontend
already expected; no gratuitous switch to numeric ids.

## DTOs are the contract, not a formality

`HotelDto`/`GeoDto`/`ListHotelsQueryDto` use explicit `@ApiProperty()` /
`@ApiPropertyOptional()` decorators from `@nestjs/swagger`, plus
`class-validator` decorators (`@IsLatitude()`, `@IsLongitude()`,
`@IsOptional()`, `@IsString()`) enforced via a global `ValidationPipe({
whitelist: true, transform: true })` in `main.ts`.

Deliberately **not** using the Swagger CLI plugin
(`nest-cli.json` → `compilerOptions.plugins: ["@nestjs/swagger"]`), which
can auto-infer `@ApiProperty()` from plain TS types without any decorators
at all. Explicit decorators were chosen instead — more verbose, but every
field's presence in the OpenAPI doc is visible directly in the DTO file
rather than depending on a compiler transform working correctly. For a
small demo API where the DTOs *are* the whole point, that legibility
seemed worth the extra lines.

Because the controller only ever returns `HotelDto` instances (built from
the service's mock array, never a raw DB row — there is no DB), there's no
path by which an internal shape could leak into a response. "Don't expose
internal entities" was satisfied structurally, not by remembering to
sanitize something.

## `GET /hotels/:id` behavior

Throws `NotFoundException` for unknown ids → real `404`, documented via
`@ApiNotFoundResponse()` on the controller method so it shows up in the
generated spec, not just as implicit REST convention.

## `GET /hotels?search=`

Case-insensitive substring match against `name` and `location`. This
wasn't strictly required by the original task, but it gives the query
parameter requirement (OpenAPI spec needing to show query params) actual
behavior behind it rather than an unused placeholder field, and gives the
Expo app's search tab something real to eventually call.

## Generating `docs/openapi.json`

`src/generate-openapi.ts` is a standalone script — not the running HTTP
server — that does:

```
NestFactory.create(AppModule, { logger: false })
  → SwaggerModule.createDocument(app, buildOpenApiDocument())
  → write docs/openapi.json
  → app.close()
  → process.exit(0)
```

`buildOpenApiDocument()` (in `src/openapi-document.ts`) is shared between
this script and `main.ts`'s interactive `/api` Swagger UI setup, so the
title/description/version config only exists in one place.

`createDocument` only needs the compiled module graph — it never calls
`app.listen()`, so no port gets bound and no server needs to be running
for codegen to work. `process.exit(0)` after `app.close()` is a defensive
measure (recommended pattern for one-shot Nest scripts): nothing in this
app currently holds the event loop open after `close()`, but it costs
nothing to force the exit rather than risk a hung process in a script
meant to run in CI/pre-commit contexts later.

Run via `bun run generate:openapi` (→ `ts-node -r tsconfig-paths/register
src/generate-openapi.ts` — `ts-node` was already a default Nest
devDependency, used here rather than bun's native TS runtime to stay on
the same compilation path as the rest of the app; see 001 for why we don't
lean on bun-as-runtime for anything decorator-heavy).

## Verification

Ran the full route surface manually against `bun run start:dev`:
`GET /hotels` (all 5), `GET /hotels?search=verona` (filters to 1),
`GET /hotels/1` (single hotel), `GET /hotels/999` (`404`), and confirmed
`/api-json`/`/api` (Swagger UI) both serve. Also parsed the generated
`docs/openapi.json` to confirm `paths` lists both routes and
`components.schemas` lists exactly `GeoDto`/`HotelDto` — no stray/internal
schemas leaking in.

On the Expo side (see `hotels/docs/logs/002-*.md`), the round-trip was
verified further by killing this server mid-session and confirming the
app's error state rendered, then restarting it and confirming recovery —
stronger evidence than a type-check that the two repos are actually talking
to each other over HTTP, not just agreeing on types.
