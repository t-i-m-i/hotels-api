# 006 — A second e2e case (DTO validation), a broken e2e suite fixed, and a real `remove()`

## Why

`test/hotels.e2e-spec.ts` only ever asserted `GET /hotels` returns 200
with a plausible shape. Useful, but as a demo of what this repo is
actually about — DTOs as the contract, enforced by a global
`ValidationPipe` — it undersold the setup. The backend's job in the
booking journey isn't to test the journey itself (that belongs to the
frontends — see `hotels-web-next`'s
`docs/logs/005-playwright-booking-e2e.md` and the RN app's
`.maestro/booking-flow.yaml`); it's to prove the contract holds. Added
one more case that does that concretely.

## What was added

```ts
it('GET /hotels rejects a non-string search query via the global ValidationPipe', async () => {
  const response = await request(app.getHttpServer())
    .get('/hotels')
    .query({ search: ['Barcelona', 'Madrid'] })
    .expect(400);

  expect(response.body.message).toEqual(
    expect.arrayContaining([expect.stringContaining('search')]),
  );
});
```

Repeating the `search` query key makes Express parse it as an array
(`?search=Barcelona&search=Madrid`), which fails `ListHotelsQueryDto`'s
`@IsString()`. It's a real HTTP round trip through the actual
`ValidationPipe({ whitelist: true, transform: true })` configured in
`main.ts`/repeated in the test's `beforeAll` — not a unit test of
`class-validator` in isolation — which is the point: proving the wiring
between controller, DTO, and global pipe actually rejects a bad request
the way the contract promises.

## Found along the way: `bun run test:e2e` currently can't run at all

Confirmed this is pre-existing, not caused by the change above — same
failure on `main` before it, reproduced by stashing the diff and
re-running. `AppModule` now imports `EventEmitterModule` from
`@nestjs/event-emitter` (added in `530235c`, "Add Bull queue and
EventEmitter2 fan-out on booking creation"), which ships as pure ESM
(`"type": "module"` in its `package.json`). `test/jest-e2e.json` has no
`transformIgnorePatterns` override, so Jest's default "don't transform
anything under `node_modules`" leaves that package's `export` syntax
unparsed:

```
SyntaxError: Unexpected token 'export'
  at .../node_modules/@nestjs/event-emitter/dist/index.js:1
```

Since `hotels.e2e-spec.ts` boots the real `AppModule` (by design — see
the file's own comment about not mocking anything there), any e2e spec
at all fails at the `beforeAll` import step, before a single test runs.
`bun run test` (unit tests, different Jest config, `rootDir: src`)
is unaffected — none of the unit specs import the full `AppModule`.

## Fix: mirror the unit-test config's `transformIgnorePatterns`

`package.json`'s own `jest` config (used by `bun run test`, unit tests)
already carries the exact fix, just never ported to
`test/jest-e2e.json`:

```json
"transformIgnorePatterns": [
  "node_modules/(?!(@nestjs/bull|@nestjs/bull-shared|@nestjs/event-emitter|eventemitter2)/)"
]
```

Added the same line to `test/jest-e2e.json`. This tells Jest to *not*
skip transforming those four packages (the default ignores all of
`node_modules`), so `ts-jest` transpiles their ESM `export` syntax to
CommonJS like it does for our own source. `bun run test:e2e` now passes
(3/3, including the new DTO-validation case above).

One leftover: Jest prints `did not exit one second after the test run
completed` after this suite — a real open handle (most likely the Bull
queue's Redis connection, or the pg Pool, not closed in `afterAll`), not
something this fix introduced or fixes. Left alone since it doesn't fail
the run; worth a look if it gets noisier once more e2e specs exist.

## `BookingsService.remove()` was a stub — implemented it

Needed for `hotels-web-next`'s new Playwright e2e
(`docs/logs/005-playwright-booking-e2e.md` over there), which cleans up
the booking it creates via `DELETE /bookings/:id`. That endpoint existed
on `BookingsController` but the service method behind it was a
placeholder returning a string, never touching the database:

```ts
remove(id: string) {
  return `This action removes a #${id} booking`;
}
```

Replaced with an actual `DELETE FROM bookings WHERE id = $1`, using
`rowCount` to distinguish "deleted" from "nothing to delete" the same
way `findOne` already does for reads:

```ts
async remove(id: string): Promise<void> {
  const result = await this.pool.query('DELETE FROM bookings WHERE id = $1', [id]);
  if (result.rowCount === 0) {
    throw new NotFoundException(`Booking with id ${id} not found`);
  }
}
```

Also tightened the controller to match: added `ParseUUIDPipe` on the
route param (every other id-bearing bookings route already validates
UUID shape this way; `remove` was the one exception), and made the
success response `204 No Content` (`@HttpCode(204)` +
`@ApiNoContentResponse()`) instead of Nest's default `200` with an
empty body, since there's nothing meaningful to return for a delete.
That's a documented-response-shape change, so re-ran
`bun run generate:openapi` in the same change per this repo's
contract-first rule.

Verified against the real dev server and shared DB: created a
throwaway booking, `DELETE` it → `204`, `DELETE` the same id again →
`404`.

`update()` is still the same kind of stub (returns a plain string,
never touches the database) — left as-is, out of scope here; nothing
currently calls it.
