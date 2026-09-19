-- Up Migration

-- BetterAuth-created users (via /sign-up/email) only supply name/email/password —
-- first_name/last_name stay populated for the existing seeded users but are no
-- longer guaranteed for new sign-ups.
ALTER TABLE users
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name DROP NOT NULL;

-- role_id is NOT NULL with no default; BetterAuth's sign-up doesn't set it, so
-- self-registered users need a default role. 2 = guest (see create-roles-table).
ALTER TABLE users
  ALTER COLUMN role_id SET DEFAULT 2;

-- Down Migration

ALTER TABLE users
  ALTER COLUMN role_id DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;