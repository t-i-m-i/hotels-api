-- Up Migration

-- Superseded by user_roles (a user can now hold more than one role; see
-- 1791057214985_create-user-roles-table.sql, which already backfilled this
-- column's data before this migration drops it).
ALTER TABLE users
  DROP COLUMN role_id;

-- Down Migration

ALTER TABLE users
  ADD COLUMN role_id SMALLINT REFERENCES roles (id);

-- Best-effort restore: picks one role per user (the lowest role_id) since
-- a user may hold multiple rows in user_roles by the time this runs.
UPDATE users u
SET
  role_id = (
    SELECT
      ur.role_id
    FROM
      user_roles ur
    WHERE
      ur.user_id = u.id
    ORDER BY
      ur.role_id
    LIMIT
      1
  );

ALTER TABLE users
  ALTER COLUMN role_id SET NOT NULL;
