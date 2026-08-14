-- Up Migration

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  hotel_id uuid NOT NULL REFERENCES hotels (id),
  check_in date NOT NULL,
  check_out date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS reservations;
