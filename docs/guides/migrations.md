# Database migrations

## The idea

A migration is a small, version-controlled SQL file that changes the
database schema — create a table, add a column, add a constraint. Instead
of hand-running SQL against Neon whenever the schema changes, every change
is written down as a file, committed to git, and applied by a tool that
remembers which files have already run. That gives us:

- **A history of the schema**, readable as a sequence of files, same as
  git gives us a history of the code.
- **A repeatable setup** — a fresh database (or a teammate's machine) gets
  to the same schema by running the same migrations, in order.
- **Reversibility** — every migration pairs an `up` (apply the change) with
  a `down` (undo it), so a bad migration can be rolled back instead of
  hand-patched.

## The library: `node-pg-migrate`

We use [`node-pg-migrate`](https://github.com/salsita/node-pg-migrate), a
standalone CLI that talks directly to Postgres via `pg` — no ORM, which
fits how this repo already works (`HotelsService` queries via a raw
`pg.Pool`, see `CLAUDE.md`). It:

- Reads `DATABASE_URL` from `.env` automatically.
- Tracks applied migrations in its own table, `pgmigrations`, created in
  the same database.
- Runs migration files **in filename order** — each file is prefixed with
  a millisecond timestamp, so creation order is run order.

Migration files live in `migrations/` at the repo root. Each one is plain
SQL with two sections:

```sql
-- Up Migration

CREATE TABLE IF NOT EXISTS example (...);

-- Down Migration

DROP TABLE IF EXISTS example;
```

`up` is what runs when you migrate forward; `down` is what runs when you
roll back — it should undo exactly what `up` did, ideally restoring the
prior schema (and, where practical, prior data) rather than just "delete
everything."

## The scripts

| Command | What it does |
|---|---|
| `bun run migrate:create <name>` | Scaffolds a new timestamped file in `migrations/` with empty `-- Up Migration` / `-- Down Migration` sections. |
| `bun run migrate:up` | Runs every migration that hasn't been applied yet, in order. |
| `bun run migrate:down` | Rolls back the **most recently applied** migration (its `down` section). |

`migrate:down` takes an optional count as an extra argument to roll back
more than one step, most-recent-first:

```bash
bun run migrate:down 3   # undo the last 3 applied migrations, in reverse order
```

There's no single flag to target one arbitrary migration by name out of
sequence — rollback is always "the last N applied," which is what keeps
the schema history linear and predictable. If you need to undo a migration
that isn't the most recent one, roll back everything after it too, then
re-apply the ones you still want with `migrate:up`.

## Adding a new table

1. `bun run migrate:create create-widgets-table`
2. Fill in `-- Up Migration` with the `CREATE TABLE` (and any seed
   `INSERT`s), and `-- Down Migration` with `DROP TABLE IF EXISTS widgets;`.
3. `bun run migrate:up` to apply it locally and confirm it runs clean.
4. Commit the migration file.

If the new table has foreign keys to another new table in the same batch
of work (e.g. `reservations.user_id → users.id`), create the referenced
table's migration first — files run in creation order, and a `REFERENCES`
to a table that doesn't exist yet fails at migration time, not at review
time.

## Altering an existing table

Don't edit an old migration file — once a migration has run anywhere
(your machine, a teammate's, prod), editing it in place means different
environments silently disagree about what "ran." Instead, create a new
migration:

```bash
bun run migrate:create add-phone-to-users
```

```sql
-- Up Migration

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;

-- Down Migration

ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

Watch for `NOT NULL` columns added to a table that may already have rows:
`ADD COLUMN ... NOT NULL` with no `DEFAULT` fails on existing rows. Either
give it a `DEFAULT`, or do it in two safer steps (add nullable, backfill,
then `ALTER COLUMN ... SET NOT NULL`).

## Dropping a table or column

Same principle — a new migration, not an edit to the one that created it:

```sql
-- Up Migration

DROP TABLE IF EXISTS widgets;

-- Down Migration

-- Recreate the table here if you want `down` to actually restore it.
-- If the drop is meant to be permanent, a no-op down is acceptable —
-- but say so, so it's a decision and not an oversight.
CREATE TABLE IF NOT EXISTS widgets (...);
```

## Starting a table over from scratch

Sometimes it's simpler to drop and recreate a table in one migration
rather than a chain of `ALTER`s — that's what `migrations/1786732681347_
create-hotels-table.sql` does: `DROP TABLE IF EXISTS hotels;` followed by
a fresh `CREATE TABLE` with the new columns, then re-`INSERT`s the seed
data. Its `down` mirrors that: drop the new table, recreate the *original*
schema, and restore the original rows — so rolling back genuinely returns
to the prior state, not just to an empty table.

## Checking status

`pgmigrations` (in the same Postgres database) has one row per applied
migration with a timestamp — query it directly if you want to see what's
been run without reading through `migrations/` by hand:

```sql
SELECT name, run_on FROM pgmigrations ORDER BY run_on;
```
