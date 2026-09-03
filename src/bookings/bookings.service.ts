import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import { EMAIL_QUEUE } from './bookings.constants';
import { BookingCreatedEvent } from './events/booking-created.event';
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

// node-pg parses a `date` column into a Date at local midnight for that
// calendar day, not UTC midnight — reading it back with getFullYear/Month/Date
// (not toISOString, which converts to UTC and can roll back a day depending
// on the server's timezone offset) is what recovers the original date.
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toBookingDto(row: BookingRow): BookingDto {
  return {
    id: row.id,
    userId: row.user_id,
    hotelId: row.hotel_id,
    checkIn: formatDateOnly(row.check_in),
    checkOut: formatDateOnly(row.check_out),
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
    checkIn: formatDateOnly(row.check_in),
    checkOut: formatDateOnly(row.check_out),
  };
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private assertCheckInNotInPast(checkIn: string) {
    const today = formatDateOnly(new Date());
    if (checkIn < today) {
      throw new BadRequestException('checkIn must not be in the past');
    }
  }

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
      AND ($4::uuid IS NULL OR id != $4::uuid)
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
    this.assertCheckInNotInPast(checkIn);
    await this.assertNoOverlap(hotelId, checkIn, checkOut);

    // create booking
    const query = /*sql*/ `
      INSERT INTO bookings (user_id, hotel_id, check_in, check_out)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [userId, hotelId, checkIn, checkOut];
    const result = await this.pool.query<BookingRow>(query, values);
    const booking = toBookingDto(result.rows[0]);

    const event = new BookingCreatedEvent(
      booking.id,
      booking.userId,
      booking.hotelId,
      booking.checkIn,
      booking.checkOut,
    );

    // Fire-and-forget: don't block the response on analytics, email, or
    // invoice generation. emit() dispatches to @OnEvent handlers
    // synchronously but doesn't await their internal async work.
    this.eventEmitter.emit('booking.created', event);
    this.emailQueue
      .add('send-confirmation-email', event)
      .catch((err: unknown) =>
        console.error(
          `Failed to enqueue send-confirmation-email for booking ${booking.id}`,
          err,
        ),
      );
    this.emailQueue
      .add('generate-invoice', event)
      .catch((err: unknown) =>
        console.error(
          `Failed to enqueue generate-invoice for booking ${booking.id}`,
          err,
        ),
      );

    return booking;
  }

  async findAll(): Promise<BookingDetailsDto[]> {
    const result = await this.pool
      .query<BookingDetailsRow>(/*sql*/ `SELECT b.id, b.check_in, b.check_out, h.name as hotel_name, u.first_name, u.last_name
        FROM bookings b
        INNER JOIN hotels h ON h.id = b.hotel_id
        INNER JOIN users u ON u.id = b.user_id
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

  async getBookingsByUser(userId: string): Promise<BookingDetailsDto[]> {
    const result = await this.pool.query<BookingDetailsRow>(
      /*sql*/ `SELECT b.id, b.check_in, b.check_out, h.name as hotel_name, u.first_name, u.last_name
      FROM bookings b
       INNER JOIN hotels h on h.id = b.hotel_id
       INNER JOIN users u on u.id = b.user_id
       WHERE b.user_id = $1
       ORDER BY b.check_in`,
      [userId],
    );
    return result.rows.map(toBookingDetailsDto);
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
