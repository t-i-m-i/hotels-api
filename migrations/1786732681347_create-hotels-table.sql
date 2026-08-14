-- Up Migration

DROP TABLE IF EXISTS hotels;

CREATE TABLE hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  city text,
  country text,
  owner_id uuid REFERENCES users (id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO
  hotels (name, description, location, latitude, longitude, city, country)
VALUES
  (
    'Hotel Barcino Central',
    'A boutique hotel steps away from Las Ramblas, blending Gothic Quarter charm with modern comfort.',
    'Barcelona, Spain',
    41.3851,
    2.1734,
    'Barcelona',
    'Spain'
  ),
  (
    'Costa del Sol Suites',
    'Bright, breezy rooms near Málaga''s old town, a short walk from the beach and cathedral.',
    'Málaga, Spain',
    36.7213,
    -4.4214,
    'Málaga',
    'Spain'
  ),
  (
    'Palazzo Roma',
    'Classic Roman elegance minutes from the Trevi Fountain and the Pantheon.',
    'Rome, Italy',
    41.9028,
    12.4964,
    'Rome',
    'Italy'
  ),
  (
    'Verona Arena View',
    'Cozy rooms overlooking Verona''s Roman arena, in the heart of Romeo and Juliet''s city.',
    'Verona, Italy',
    45.4384,
    10.9916,
    'Verona',
    'Italy'
  ),
  (
    'Alpenblick Salzburg',
    'A charming stay by the Salzach river with views of the Hohensalzburg Fortress.',
    'Salzburg, Austria',
    47.8095,
    13.055,
    'Salzburg',
    'Austria'
  );

-- Down Migration

DROP TABLE IF EXISTS hotels;

CREATE TABLE hotels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL
);

INSERT INTO
  hotels (id, name, description, location, latitude, longitude)
VALUES
  (
    '1',
    'Hotel Barcino Central',
    'A boutique hotel steps away from Las Ramblas, blending Gothic Quarter charm with modern comfort.',
    'Barcelona, Spain',
    41.3851,
    2.1734
  ),
  (
    '2',
    'Costa del Sol Suites',
    'Bright, breezy rooms near Málaga''s old town, a short walk from the beach and cathedral.',
    'Málaga, Spain',
    36.7213,
    -4.4214
  ),
  (
    '3',
    'Palazzo Roma',
    'Classic Roman elegance minutes from the Trevi Fountain and the Pantheon.',
    'Rome, Italy',
    41.9028,
    12.4964
  ),
  (
    '4',
    'Verona Arena View',
    'Cozy rooms overlooking Verona''s Roman arena, in the heart of Romeo and Juliet''s city.',
    'Verona, Italy',
    45.4384,
    10.9916
  ),
  (
    '5',
    'Alpenblick Salzburg',
    'A charming stay by the Salzach river with views of the Hohensalzburg Fortress.',
    'Salzburg, Austria',
    47.8095,
    13.055
  );
