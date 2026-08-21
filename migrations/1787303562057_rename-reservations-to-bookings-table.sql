-- Up Migration

ALTER TABLE reservations RENAME TO bookings;

-- Down Migration

ALTER TABLE bookings RENAME TO reservations;
