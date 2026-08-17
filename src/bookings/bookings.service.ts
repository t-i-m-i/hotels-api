import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingDto } from './dto/booking.dto';

type ReservationRow = {
  id: string;
  user_id: string;
  hotel_id: string;
  check_in: Date;
  check_out: Date;
};

function toBookingDto(row: ReservationRow): BookingDto {
  return {
    id: row.id,
    userId: row.user_id,
    hotelId: row.hotel_id,
    checkIn: row.check_in.toISOString().slice(0, 10),
    checkOut: row.check_out.toISOString().slice(0, 10),
  };
}

@Injectable()
export class BookingsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(createBookingDto: CreateBookingDto) {
    // TODO(auth): replace with the authenticated user's id once BetterAuth is wired in — see guard/@CurrentUser() plan
    const userId = 'bf721a73-1a8b-4de2-b74b-a747e1197d3f';
    const { hotelId, checkIn, checkOut } = createBookingDto;
    const query = `
      INSERT INTO reservations (user_id, hotel_id, check_in, check_out)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [userId, hotelId, checkIn, checkOut];
    const result = await this.pool.query<ReservationRow>(query, values);
    return toBookingDto(result.rows[0]);
  }

  findAll() {
    return `This action returns all bookings`;
  }

  findOne(id: string) {
    return `This action returns a #${id} booking`;
  }

  update(id: string, updateBookingDto: UpdateBookingDto) {
    return `This action updates a #${id} booking`;
  }

  remove(id: string) {
    return `This action removes a #${id} booking`;
  }
}
