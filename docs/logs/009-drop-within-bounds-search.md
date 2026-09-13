# 009 — Drop `search` from `/hotels/within-bounds`

No map UI (web or RN) ever set `search` on `getHotelsInBounds` — neither the
global map nor the hotel detail map has a search box, and none was planned.
It was speculative plumbing carried over from `GET /hotels`'s real,
used `search` param. Removed to keep the endpoint's surface matched to actual
use, per "don't build for a maybe."

## What changed

- `HotelsWithinBoundsQueryDto`: dropped `search` (and its now-unused
  `IsOptional`/`IsString`/`MaxLength` imports).
- `hotels.controller.ts#findWithinBounds`: no longer passes `query.search`.
- `hotels.service.ts#findWithinBounds`: dropped the `search` param and the
  `name ILIKE … OR location ILIKE …` clause from the SQL — the query is now
  just the lat/lng range filter.
- `docs/openapi.json` regenerated.

`GET /hotels?search=` (`findAll`, `ListHotelsQueryDto`) is untouched — that's
the real, working list search (home tab / `/` list), matched against `name`
and `location` deliberately (see `002-hotels-module-and-openapi.md`).
