-- Up Migration

ALTER TABLE bookings
  ADD COLUMN is_synthetic boolean NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE bookings
  DROP COLUMN is_synthetic;
