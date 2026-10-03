-- Up Migration

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id SMALLINT NOT NULL REFERENCES roles (id),
  PRIMARY KEY (user_id, role_id)
);

-- Backfill: every existing user keeps the single role they already had.
INSERT INTO
  user_roles (user_id, role_id)
SELECT
  id,
  role_id
FROM
  users;

-- Down Migration

DROP TABLE IF EXISTS user_roles;
