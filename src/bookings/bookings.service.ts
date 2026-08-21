import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { BookingDetailsDto, BookingDto } from './dto/booking.dto';

type BookingRow = {
  id: string;
  user_id: string;
  hotel_id: string;
  check_in: Date;
  check_out: Date;
};

function toBookingDto(row: BookingRow): BookingDto {
  return {
    id: row.id,
    userId: row.user_id,
    hotelId: row.hotel_id,
    checkIn: row.check_in.toISOString().slice(0, 10),
    checkOut: row.check_out.toISOString().slice(0, 10),
  };
}

type BookingDetailsRow = {
  id: string;
  check_in: Date;
  check_out: Date;
  hotel_name: string;
  first_name: string;
  last_name: string;
};

function toBookingDetailsDto(row: BookingDetailsRow): BookingDetailsDto {
  return {
    id: row.id,
    hotel: { name: row.hotel_name },
    user: { firstName: row.first_name, lastName: row.last_name },
    checkIn: row.check_in.toISOString().slice(0, 10),
    checkOut: row.check_out.toISOString().slice(0, 10),
  };
}

@Injectable()
export class BookingsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  private async assertNoOverlap(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    excludeBookingId?: string,
  ) {
    if (checkIn >= checkOut) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const overlap = await this.pool.query(
      /*sql*/ `SELECT 1 FROM bookings
      WHERE hotel_id = $1 AND check_in < $3 AND check_out > $2
      AND ($4::text IS NULL OR id != $4)
      LIMIT 1`,
      [hotelId, checkIn, checkOut, excludeBookingId ?? null],
    );
    if (overlap.rows.length > 0) {
      throw new ConflictException(
        'hotel is already booked for the given date range',
      );
    }
  }

  async create(createBookingDto: CreateBookingDto) {
    // TODO(auth): replace with the authenticated user's id once BetterAuth is wired in — see guard/@CurrentUser() plan
    const userId = 'bf721a73-1a8b-4de2-b74b-a747e1197d3f';
    const { hotelId, checkIn, checkOut } = createBookingDto;

    // additional validation beyond dto
    await this.assertNoOverlap(hotelId, checkIn, checkOut);

    // create booking
    const query = /*sql*/ `
      INSERT INTO bookings (user_id, hotel_id, check_in, check_out)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [userId, hotelId, checkIn, checkOut];
    const result = await this.pool.query<BookingRow>(query, values);
    return toBookingDto(result.rows[0]);
  }

  async findAll(): Promise<BookingDetailsDto[]> {
    const result = await this.pool
      .query<BookingDetailsRow>(/*sql*/ `SELECT b.id, b.check_in, b.check_out, h.name as hotel_name, u.first_name, u.last_name
        FROM bookings b
        LEFT JOIN hotels h ON h.id = b.hotel_id
        LEFT JOIN users u ON u.id = b.user_id
      `);
    return result.rows.map(toBookingDetailsDto);
  }

  async findCurrentByHotel(hotelId: string): Promise<BookingDto[]> {
    const result = await this.pool.query<BookingRow>(
      /*sql*/ `SELECT id, user_id, hotel_id, check_in, check_out FROM bookings
       WHERE hotel_id = $1 AND check_out >= CURRENT_DATE
       ORDER BY check_in`,
      [hotelId],
    );
    return result.rows.map(toBookingDto);
  }

  async findOne(id: string): Promise<BookingDto> {
    const result = await this.pool.query<BookingRow>(
      `SELECT * FROM bookings WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }
    return toBookingDto(row);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  update(id: string, updateBookingDto: UpdateBookingDto) {
    return `This action updates a #${id} booking`;
  }

  remove(id: string) {
    return `This action removes a #${id} booking`;
  }
}
