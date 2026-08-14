-- Up Migration

CREATE TABLE IF NOT EXISTS roles (
  id SMALLINT PRIMARY KEY,
  name text UNIQUE NOT NULL
);

INSERT INTO
  roles (id, name)
VALUES
  (1, 'admin'),
  (2, 'guest'),
  (3, 'host');

-- Down Migration

DROP TABLE IF EXISTS roles;
