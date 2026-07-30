# docs/

Two kinds of documents live here:

- **Top-level `.md` files** — reference docs that describe how the project
  works right now (architecture, decisions, how-tos). These get edited in
  place as things change; they describe the _current_ state, not history.
- **`logs/`** — a dated, append-only log of work sessions. Each entry is a
  snapshot of what was done, why, and anything non-obvious that came up
  (gotchas, things that were confusing, decisions made in the moment). Logs
  are never edited after the fact — if something in an old log turns out to
  be wrong, correct it in a newer entry or in a top-level reference doc
  instead.

Naming: `logs/NNN-short-topic.md`, zero-padded, incrementing (`001-`,
`002-`, …).

`openapi.json` in this directory is generated output (`bun run
generate:openapi`), not a reference doc — see the root `README.md`.

(Same convention as the sibling [`hotels`](../../hotels/docs/README.md)
app's `docs/`.)
