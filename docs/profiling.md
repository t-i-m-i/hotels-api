# Profiling the server (Clinic.js and `--inspect`)

Both tools attach to a *running instance* of the compiled server — they don't work against
`bun run start:dev`'s watch process, and they need a build first.

## Prerequisites

```bash
bun run build
```

This compiles TypeScript into `dist/`. Because `nest-cli.json` sets `sourceRoot: "src"`, the entry
point ends up at **`dist/src/main.js`**, not `dist/main.js` — use that path in every command below.

Make sure no other instance of the app (e.g. `bun run start:dev`) is already running — clinic and
`--inspect` both start the server themselves via `dist/src/main.js`, listening on the usual port 3000.

## Clinic Doctor

`clinic doctor -- node dist/src/main.js` runs your app as-is, with a profiling agent attached — it's
not a separate process alongside your server, it *is* your server for this run. While it's up, there's
no UI; drive real traffic at it from another terminal and the report is only produced once you stop it.

```bash
bun run build
bunx clinic doctor -- node dist/src/main.js
```

1. Wait for the Nest startup logs.
2. Generate some load so there's something to analyse — an idle process produces a flat,
   uninteresting report:
   ```bash
   curl http://localhost:3000/hotels
   curl http://localhost:3000/hotels/<some-id>
   ```
   For a more realistic profile, loop a few dozen requests, or point a load tool
   (`autocannon`, `k6`, etc.) at it briefly.
3. Press `Ctrl+C` in the terminal running clinic. This stops the process **and** triggers report
   generation (clinic's convention — it needs the interrupt signal to know profiling is done).
4. Clinic writes an HTML report under `.clinic/<pid>.clinic-doctor.html` and opens it automatically.
   It shows CPU usage, event loop delay, active handles, and memory over the sampled window — useful
   for spotting blocking synchronous work, GC pressure, or CPU bottlenecks.

Other clinic subcommands work the same way, swapping `doctor` for:
- `bunx clinic bubbleprof -- node dist/src/main.js` — async operation flow / where time is spent
  waiting.
- `bunx clinic flame -- node dist/src/main.js` — flamegraph of CPU time per function call.

`.clinic/` is generated output — don't commit it (check it's covered by `.gitignore`).

## `node --inspect`

For interactive step-through debugging (breakpoints, call stack, variable inspection) rather than a
generated report, use the built-in inspector instead of clinic:

```bash
bun run build
node --inspect dist/src/main.js
```

1. Open `chrome://inspect` in Chrome, click "Open dedicated DevTools for Node" (or click the
   `inspect` link under "Remote Target" once it appears).
2. Set breakpoints in the `Sources` panel, then hit `localhost:3000` to trigger your route handlers.
3. Use `--inspect-brk` instead of `--inspect` if you want execution paused on the very first line
   until DevTools attaches.

VS Code users can alternatively attach via the built-in "Attach to Node Process" debug
configuration instead of Chrome DevTools.
