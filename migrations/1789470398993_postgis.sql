-- Up Migration
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE hotels
  ADD COLUMN coordinates GEOGRAPHY(Point, 4326) -- SRID 4326 = WGS84 (standard GPS coords)
  -- compute coordinates automatically from latitude/longitude on every insert/update
  GENERATED ALWAYS AS (ST_Point(longitude, latitude)::GEOGRAPHY) STORED;

CREATE INDEX hotels_coordinates_idx ON hotels USING GIST (coordinates);

-- Down Migration

ALTER TABLE hotels
  DROP COLUMN coordinates;
