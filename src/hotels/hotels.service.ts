import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import { HotelDto } from './dto/hotel.dto';
import { PaginatedHotelsDto } from './dto/paginated-hotels.dto';
import { hotelImages } from './hotel-images';

type HotelRow = {
  id: string;
  name: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  // Only selected by findNearest.
  distance_m?: number;
};

function toHotelDto(row: HotelRow): HotelDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    location: row.location,
    geo: { latitude: row.latitude, longitude: row.longitude },
    images: hotelImages(row.id, row.name),
    ...(row.distance_m != null && {
      distanceMeters: Math.round(row.distance_m),
    }),
  };
}

function toPaginated(
  rows: HotelRow[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedHotelsDto {
  return {
    data: rows.map(toHotelDto),
    meta: {
      pagination: {
        page,
        pageSize,
        pageCount: Math.ceil(total / pageSize),
        total,
      },
    },
  };
}

@Injectable()
export class HotelsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findAll(
    search?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedHotelsDto> {
    const offset = (page - 1) * pageSize;

    const pageSql = /*sql*/ `SELECT id, name, description, location, latitude, longitude
       FROM hotels
       WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR location ILIKE '%' || $1 || '%')
       ORDER BY name
       LIMIT $2 OFFSET $3`;

    const countSql = /*sql*/ `SELECT COUNT(*)::int AS total
      FROM hotels
      WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR location ILIKE '%' || $1 || '%')`;

    const [result, countResult] = await Promise.all([
      this.pool.query<HotelRow>(pageSql, [search ?? null, pageSize, offset]),
      this.pool.query<{ total: number }>(countSql, [search ?? null]),
    ]);

    return toPaginated(
      result.rows,
      countResult.rows[0]?.total ?? 0,
      page,
      pageSize,
    );
  }

  async findOne(id: string): Promise<HotelDto> {
    const result = await this.pool.query<HotelRow>(
      /*sql*/ `SELECT id, name, description, location, latitude, longitude
       FROM hotels
       WHERE id = $1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Hotel with id "${id}" not found`);
    }

    return toHotelDto(row);
  }

  async findWithinBounds(bounds: {
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  }): Promise<HotelDto[]> {
    // Clamp latitude to the valid range so a zoomed-out map ("neLat: 140")
    // degrades to "everything" instead of returning nothing.
    const latLo = Math.max(-90, Math.min(bounds.swLat, bounds.neLat));
    const latHi = Math.min(90, Math.max(bounds.swLat, bounds.neLat));

    // Longitude: normal case is swLng <= neLng. A viewport straddling the
    // antimeridian (±180) arrives as swLng > neLng and means
    // "longitude >= swLng OR longitude <= neLng". Our data is all in Europe so
    // this branch is dead today, but it's one line and avoids a silent empty
    // result if that ever changes.
    const crossesAntimeridian = bounds.swLng > bounds.neLng;
    const lonClause = crossesAntimeridian
      ? '(longitude >= $3 OR longitude <= $4)'
      : 'longitude BETWEEN $3 AND $4';

    const sql = /*sql*/ `
    SELECT id, name, description, location, latitude, longitude
    FROM hotels
    WHERE latitude BETWEEN $1 AND $2
      AND ${lonClause}
    ORDER BY name
    LIMIT 500`;

    const { rows } = await this.pool.query<HotelRow>(sql, [
      latLo,
      latHi,
      bounds.swLng,
      bounds.neLng,
    ]);

    return rows.map(toHotelDto);
  }

  async findNearest(
    longitude: number,
    latitude: number,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<PaginatedHotelsDto> {
    const offset = (page - 1) * pageSize;

    const pageSql = /*sql*/ `
    SELECT id, name, description, location, latitude, longitude,
           ST_Distance(coordinates, ST_Point($1, $2)::geography) AS distance_m
    FROM hotels
    WHERE ST_DWITHIN(coordinates, ST_Point($1, $2)::geography, 300000)
    -- order by distance AND id in case of ties (more hotels with the same distance), so results are stable across pages
    ORDER BY coordinates <-> ST_Point($1, $2)::geography, id
    LIMIT $3 OFFSET $4`;

    const countSql = /*sql*/ `
    SELECT COUNT(*)::int AS total
    FROM hotels
    WHERE ST_DWITHIN(coordinates, ST_Point($1, $2)::geography, 300000)`;

    const [result, countResult] = await Promise.all([
      this.pool.query<HotelRow>(pageSql, [
        longitude,
        latitude,
        pageSize,
        offset,
      ]),
      this.pool.query<{ total: number }>(countSql, [longitude, latitude]),
    ]);

    return toPaginated(
      result.rows,
      countResult.rows[0]?.total ?? 0,
      page,
      pageSize,
    );
  }
}
