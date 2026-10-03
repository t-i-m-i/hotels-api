# 013 — Multi-role support: user_roles table + customSession

`users.role_id` only ever let an account hold one role (guest/host/admin).
The mobile app is adding a role switcher (an account can be both a guest
and a host), which needs an account to hold more than one role at once —
so `role_id` is gone, replaced by a `user_roles` join table.

## What changed

- `migrations/*_create-user-roles-table.sql` (new): `user_roles(user_id,
  role_id)`, composite PK, backfilled from the (still-present-at-that-point)
  `users.role_id` so every existing account kept its role.
- `migrations/*_drop-role-id-from-users.sql` (new): drops `users.role_id`.
  Down migration restores it best-effort (picks the lowest `role_id` per
  user from `user_roles`, since a user may hold more than one by the time
  a rollback runs).
- `src/auth/auth.ts`:
  - Removed the `user.additionalFields.roleId` mapping (that column is
    gone).
  - Added the `customSession` plugin: joins `user_roles -> roles` fresh on
    every session fetch and attaches `roles: string[]` (role *names*, not
    ids) to `session.user`. `additionalFields` can't do this — it only maps
    a single column on the user's own row, and roles are now one-to-many.
  - Added `databaseHooks.user.create.after`: inserts a `guest` (`role_id`
    2) row into `user_roles` for every new signup. Previously a DB
    `DEFAULT 2` on `users.role_id` covered this for free; dropping the
    column removed that safety net, so it has to happen here instead. Host
    and admin rows are still only ever added by hand (or, later, by a
    payment flow) — never self-service.

## Gotcha

`customSession`'s client-side type helper (`customSessionClient<typeof
auth>()`) requires importing the server's actual `Auth` instance type —
which doesn't work from the `hotels` repo, since it isn't a shared package
with this one. The mobile app hand-types `session.user.roles` locally
instead (see its own log entry) rather than inferring it — that typing has
to be kept in sync by hand if this plugin's returned shape ever changes.

## Manual verification

Ran both migrations against the dev DB and confirmed: `users` no longer has
`role_id`, and `user_roles` carried every existing account's prior role
over correctly (6 guest, 1 host, 1 admin, matching the pre-migration
`role_id` values).
