import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import { HotelDto } from './dto/hotel.dto';

type HotelRow = {
  id: string;
  name: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
};

function toHotelDto(row: HotelRow): HotelDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    location: row.location,
    geo: { latitude: row.latitude, longitude: row.longitude },
  };
}

@Injectable()
export class HotelsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findAll(search?: string): Promise<HotelDto[]> {
    const result = await this.pool.query<HotelRow>(
      /*sql*/ `SELECT id, name, description, location, latitude, longitude
       FROM hotels
       WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR location ILIKE '%' || $1 || '%')
       ORDER BY name`,
      [search ?? null],
    );

    return result.rows.map(toHotelDto);
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
}
