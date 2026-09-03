# Diagrams

Diagram-as-code for this project. One `.md` file per diagram, each holding a
fenced ` ```mermaid ` block plus a short prose description.

## Conventions

- **Tool: Mermaid.** It renders inline on GitHub and in most editors with no
  build step or committed image — the fenced block is the single source of
  truth. (D2 was considered; it needs a toolchain and a separately-committed
  rendered image that drifts from its source.)
- Like the top-level `docs/*.md` reference docs, these describe the **current**
  state of the system and are **edited in place** as the code changes — they are
  not dated logs.
- Filename: `NNN-short-topic.md`, zero-padded, matching the `docs/logs/` entry
  the diagram first came from where there is one.
- Keep each diagram scoped to one flow or one module. Split rather than grow a
  single diagram past readability.

## Index

| Diagram | Describes |
|---|---|
| [005-booking-creation-event-and-queue-flow.md](005-booking-creation-event-and-queue-flow.md) | What happens when a booking is created: the synchronous request path vs. the EventEmitter2 and Bull queue paths that run off it. Companion to `docs/logs/005-queue-and-event-driven-bookings.md`. |
