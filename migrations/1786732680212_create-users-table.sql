-- Up Migration

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  role_id SMALLINT NOT NULL REFERENCES roles (id)
);

INSERT INTO
  users (first_name, last_name, email, role_id)
VALUES
  ('Alice', 'Nguyen', 'alice.nguyen@example.com', 2),
  ('Marcus', 'Chen', 'marcus.chen@example.com', 2),
  ('Priya', 'Sharma', 'priya.sharma@example.com', 2),
  ('Diego', 'Alvarez', 'diego.alvarez@example.com', 2),
  ('Elena', 'Kowalski', 'elena.kowalski@example.com', 3);

-- Down Migration

DROP TABLE IF EXISTS users;
