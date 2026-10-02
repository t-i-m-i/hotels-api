-- Up Migration

CREATE TYPE booking_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show'
);

ALTER TABLE bookings
  ADD COLUMN status booking_status NOT NULL DEFAULT 'pending';

-- Down Migration

ALTER TABLE bookings
  DROP COLUMN status;

DROP TYPE booking_status;
