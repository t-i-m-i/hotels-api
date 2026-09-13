# 008 — `GET /hotels/within-bounds`

New endpoint backing viewport-driven map loading in `hotels` (RN) and
`hotels-web-next`, replacing the "load every hotel, filter/paginate
client-side" approach those apps used for their map screens.

## What changed

- `src/hotels/dto/hotels-within-bounds-query.dto.ts`: `swLat`/`swLng`/
  `neLat`/`neLng` (validated `-90..90` / `-180..180`, coerced from query
  strings via `@Type(() => Number)`) + optional `search` (matched against
  `name`/`location`, same as `GET /hotels`).
- `HotelsService#findWithinBounds`: plain `WHERE latitude BETWEEN … AND
longitude BETWEEN …` (`ILIKE` for search), hard `LIMIT 500`, no pagination —
  a viewport result is naturally bounded, and pagination semantics didn't fit
  "give me every pin in view". Ordered by `name` for a stable result set.
- Not paginated like `GET /hotels`, deliberately: see decision 2 in
  `docs/viewport-hotels-and-pagination-plan.md` history (a cap, not a page,
  is the right shape until we need clustering).

## Gotchas

- Latitude bounds are clamped to `[-90, 90]` so a zoomed-out client sending
  something like `neLat: 140` degrades to "everything in range" instead of
  silently returning nothing.
- Longitude handles the antimeridian-crossing case (`swLng > neLng` →
  `OR` instead of `BETWEEN`) even though our current data is all in Europe
  and can't trigger it — one line, avoids a silent empty result if that ever
  changes.
- No PostGIS involved — this is flat lat/lng range filtering, not a real
  geospatial query. Fine at current data size; revisit if `hotels` grows
  enough for the `BETWEEN` scan to matter.
