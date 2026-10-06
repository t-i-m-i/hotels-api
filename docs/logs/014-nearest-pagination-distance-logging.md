# 014 — Paginated /hotels/nearest with distance, plus a dev request logger

`GET /hotels/nearest` used to return the 5 closest hotels as a bare array.
The mobile app's new nearest screen reuses its infinite-scroll hotel list,
so the endpoint now paginates like `GET /hotels` and reports how far away
each hotel is. A dev-only request logger was added at the same time
because Nest logs nothing per request by default.

## What changed

- `src/hotels/dto/nearest-hotels-query.dto.ts`: optional `page` (>= 1) and
  `pageSize` (1–80, same bounds as `ListHotelsQueryDto`).
- `src/hotels/hotels.service.ts`
  - `findNearest(longitude, latitude, page = 1, pageSize = 20)` runs a page
    query and a `COUNT(*)` query in parallel, both filtered by the same
    300 km `ST_DWITHIN`, and returns `PaginatedHotelsDto`.
  - The page query orders by `coordinates <-> point, id`. The `id`
    tiebreaker is needed: `LIMIT/OFFSET` pages are separate queries, and
    hotels at the same distance may otherwise be ordered differently each
    time, so one can appear on two pages and another on none.
  - It also selects `ST_Distance(coordinates, point) AS distance_m`, mapped
    to `distanceMeters` (rounded to whole meters). `ST_DWITHIN` only
    returns a boolean, and `<->` is kept for `ORDER BY` because it can use
    the spatial index; the two differ by a fraction of a percent
    (sphere vs spheroid), which doesn't matter for sorting or a "1.2 km"
    label.
  - New `toPaginated(rows, total, page, pageSize)` helper builds the
    `{ data, meta.pagination }` response; `findAll` uses it too.
- `src/hotels/hotels.controller.ts`: `findNearest` takes the whole query
  DTO and returns `PaginatedHotelsDto`. **Breaking change** to the
  response shape; the other frontends will adopt it later.
- `src/hotels/dto/hotel.dto.ts`: `HotelDto.distanceMeters?` (optional). It
  is only present on `/hotels/nearest`; `toHotelDto` adds it with a
  conditional spread (`...(row.distance_m != null && { ... })`) so the key
  is absent, not `undefined`, on every other endpoint. The check is
  `!= null` rather than truthiness so a distance of `0` is still returned.
- `docs/openapi.json`: regenerated (`bun run generate:openapi`).
- `src/hotels/hotels.service.spec.ts` (new): 8 tests for `findNearest`
  using a fake `pool.query` — default and explicit paging, `LIMIT/OFFSET`,
  lng/lat parameter order, the `id` tiebreaker, identical radius filters
  in both queries, DTO mapping and `pageCount`, an empty result, a missing
  count row, and the rounded `distanceMeters`.
- `src/main.ts`: when `NODE_ENV !== 'production'`, Express middleware logs
  one `[HTTP] METHOD url status Nms` line per request via Nest's `Logger`.
  Registered before `listen()` so it runs ahead of every route. It is
  middleware rather than an interceptor so it also sees BetterAuth's raw
  routes, 404s and guard/validation failures. No headers or bodies, unlike
  `LoggingInterceptor`, which stays available for per-route debugging (its
  `@UseInterceptors` usages in the hotels and bookings controllers are
  commented out).

## Gotchas

- The service spec only checks the SQL text and parameters through a fake
  pool. It can't tell you PostGIS returns the right hotels in the right
  order; that needs a real-database e2e test.
- `pg` returns `float8` (what `ST_Distance` yields) as a JS number, so
  `Math.round` is safe. A `numeric` column would arrive as a string.
- When a field "doesn't show up" in the app, check the running server
  before the client: `dist/` was stale and `curl` showed no
  `distanceMeters` even though the source was correct. Rebuild
  (`bun run build`) or restart `start:dev`.
- `bookings.controller.spec.ts` currently fails: it doesn't provide
  `FirebasePushService`, which `BookingsService` now depends on. Unrelated
  to this work, and not fixed here.
