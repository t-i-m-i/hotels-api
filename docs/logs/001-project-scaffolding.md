# 001 — Project scaffolding

## What we did

Bootstrapped this repo from scratch as the backend for the [Hotels
app](../../hotels), which previously kept its 5 hotels as a static local
array. Goal: a NestJS REST API fronting that data, with a generated OpenAPI
contract the Expo app can codegen typed clients against.

- Scaffolded via `bunx @nestjs/cli new . --skip-install --package-manager
  npm --skip-git`, then `bun install` ourselves — see "bun + `nest new`"
  below for why.
- Added `@nestjs/swagger`, `@nestjs/config`, `class-validator`,
  `class-transformer` via `bun add`.
- No `.gitignore` came with the scaffold when generating into an existing
  (non-empty-target) directory this way — added one by hand (`node_modules`,
  `dist`, `.env`, OS/IDE cruft) before anything got staged.
- `git init` after the scaffold + gitignore were in place.

## bun + `nest new` — what works and what doesn't

`@nestjs/cli`'s `nest new` does not offer bun as a package-manager choice
in its scaffolding prompt — this is a known gap, not something we did
wrong. Workaround used here: `--skip-install` to stop it from running
`npm install` itself, then `bun install` by hand once the scaffold exists.

The part that *does* just work: running the generated scripts via `bun run
<script>`. `bun run start:dev` → `nest start --watch`, `bun run build` →
`nest build`, etc. all execute fine, because `bun run` here is only acting
as the script runner — the `nest` CLI binary itself shebangs to `node`, so
the actual Nest process still runs on Node regardless of bun being the
outer package manager. This matters because Nest's decorator-heavy code
(class DTOs, `@Module`, etc.) relies on `reflect-metadata`, and getting
that working under bun's *own* runtime (as opposed to bun-as-script-runner)
has historically been the friction point with bun + Nest. We never had to
make that bet — nothing here runs the compiled/dev Nest process directly
under bun's runtime, only via `bun run` → `node`.

One blocked postinstall showed up during `bun install`
(`unrs-resolver`'s postinstall, an ESLint dependency's native-binary
fetch) — left blocked (bun's default), it only affects lint tooling, not
the app itself.

## Structure decided on

```
src/
  main.ts              # bootstrap: CORS, ValidationPipe, Swagger UI at /api
  app.module.ts         # ConfigModule.forRoot({ isGlobal: true }) + HotelsModule
  openapi-document.ts    # shared DocumentBuilder config (used by main.ts and generate-openapi.ts)
  generate-openapi.ts    # standalone script, see 002
  hotels/                # see 002
docs/
  openapi.json           # generated, committed
```

The default `AppController`/`AppService` scaffold got deleted — nothing in
this API needs a root "hello world" route, and keeping unused scaffold
code around just to keep the default shape didn't seem worth it for a
single-purpose demo API.

## Env / config

`.env.example` (committed) documents `PORT` and a placeholder
`DATABASE_URL` — the latter isn't read by anything yet (see 002 for why:
data is still mocked). `.env` itself is gitignored. `ConfigModule.forRoot({
isGlobal: true })` is wired with no `validationSchema`, so a missing
`DATABASE_URL` doesn't fail startup — it's forward-compat documentation,
not an enforced requirement.
