-- Up Migration

ALTER TABLE users
  ADD COLUMN name text,
  ADD COLUMN email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN image text;

UPDATE users SET name = first_name || ' ' || last_name WHERE name IS NULL;

ALTER TABLE users ALTER COLUMN name SET NOT NULL;

-- Down Migration

ALTER TABLE users
  DROP COLUMN name,
  DROP COLUMN email_verified,
  DROP COLUMN image;