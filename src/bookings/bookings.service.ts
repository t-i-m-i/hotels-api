import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import {
  BookingDetailsDto,
  BookingDto,
  HostHotelBookingsDto,
} from './dto/booking.dto';
import { BookingStatus } from './booking-status.enum';
import {
  ALLOWED_TRANSITIONS,
  BookingActor,
  effectiveStatusSql,
  getAllowedStatusChanges,
} from './booking-status-transitions';
import { FirebasePushService } from '../push-notifications/firebase-push.service';

type BookingRow = {
  id: string;
  user_id: string;
  hotel_id: string;
  check_in: Date;
  check_out: Date;
  status: BookingStatus;
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
    status: row.status,
  };
}

type BookingDetailsRow = {
  id: string;
  check_in: Date;
  check_out: Date;
  status: BookingStatus;
  hotel_id: string;
  hotel_name: string;
  first_name: string;
  last_name: string;
};

function toBookingDetailsDto(
  row: BookingDetailsRow,
  actor: BookingActor,
): BookingDetailsDto {
  return {
    id: row.id,
    hotel: { name: row.hotel_name },
    user: { firstName: row.first_name, lastName: row.last_name },
    checkIn: formatDateOnly(row.check_in),
    checkOut: formatDateOnly(row.check_out),
    status: row.status,
    allowedStatusChanges: getAllowedStatusChanges(
      actor,
      row.status,
      formatDateOnly(row.check_in),
      formatDateOnly(row.check_out),
      formatDateOnly(new Date()),
    ),
  };
}

@Injectable()
export class BookingsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly firebasePushService: FirebasePushService,
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

  async create(
    createBookingDto: CreateBookingDto,
    userId: string,
    isSynthetic = false,
  ) {
    const { hotelId, checkIn, checkOut } = createBookingDto;

    // additional validation beyond dto
    this.assertCheckInNotInPast(checkIn);
    await this.assertNoOverlap(hotelId, checkIn, checkOut);

    // create booking
    const query = /*sql*/ `
      INSERT INTO bookings (user_id, hotel_id, check_in, check_out, is_synthetic)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [userId, hotelId, checkIn, checkOut, isSynthetic];
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

  // TODO investigate if it is secure to return user_id here or maybe it should be returned user_id only if the booking is from the currently logged in user - but then verify useQuery cache keys on the frontend if it as a user_id string in it.
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
    const result = await this.pool.query<
      BookingDetailsRow & { user_id: string; owner_id: string }
    >(
      /*sql*/ `SELECT b.id, b.user_id, b.check_in, b.check_out, ${effectiveStatusSql('b')} as status, h.id as hotel_id, h.name as hotel_name, h.owner_id, u.first_name, u.last_name
      FROM bookings b
       INNER JOIN hotels h on h.id = b.hotel_id
       INNER JOIN users u on u.id = b.user_id
       WHERE b.user_id = $1
       ORDER BY b.check_in`,
      [userId],
    );
    return result.rows.map((row) =>
      toBookingDetailsDto(row, row.user_id === row.owner_id ? 'host' : 'guest'),
    );
  }

  async getByHost(hostId: string): Promise<HostHotelBookingsDto[]> {
    const result = await this.pool.query<BookingDetailsRow>(
      /*sql*/ `SELECT
        b.id,
        b.check_in,
        b.check_out,
        ${effectiveStatusSql('b')} as status,
        h.id as hotel_id,
        h.name as hotel_name,
        coalesce(u.first_name, 'Unknown') as first_name,
        coalesce(u.last_name, 'Unknown') as last_name
      FROM bookings b
       INNER JOIN hotels h on h.id = b.hotel_id
       LEFT JOIN users u on u.id = b.user_id
       WHERE h.owner_id = $1
       ORDER BY h.name, b.check_in`,
      [hostId],
    );

    const responseMap = new Map<string, HostHotelBookingsDto>();
    for (const row of result.rows) {
      const hotelId = row.hotel_id;
      if (!responseMap.has(hotelId)) {
        responseMap.set(hotelId, {
          hotelId: row.hotel_id,
          hotelName: row.hotel_name,
          bookings: [],
        });
      }
      const hostHotelBookingsDto = responseMap.get(hotelId)!;
      hostHotelBookingsDto.bookings.push({
        id: row.id,
        user: { firstName: row.first_name, lastName: row.last_name },
        checkIn: formatDateOnly(row.check_in),
        checkOut: formatDateOnly(row.check_out),
        status: row.status,
        allowedStatusChanges: getAllowedStatusChanges(
          'host',
          row.status,
          formatDateOnly(row.check_in),
          formatDateOnly(row.check_out),
          formatDateOnly(new Date()),
        ),
      });
    }

    return Array.from(responseMap.values());
  }

  async findOne(id: string): Promise<BookingDto> {
    const result = await this.pool.query<BookingRow>(
      /*sql*/ `SELECT b.id, b.user_id, b.hotel_id, b.check_in, b.check_out,
        ${effectiveStatusSql('b')} as status
        FROM bookings b WHERE b.id = $1`,
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

  async updateStatus(
    id: string,
    status: BookingStatus,
    callerId: string,
  ): Promise<BookingDto> {
    const current = await this.pool.query<BookingRow & { owner_id: string }>(
      /*sql*/ `SELECT b.id, b.user_id, b.hotel_id, b.check_in, b.check_out,
        ${effectiveStatusSql('b')} as status, h.owner_id
        FROM bookings b
        INNER JOIN hotels h ON h.id = b.hotel_id
        WHERE b.id = $1`,
      [id],
    );
    const existing = current.rows[0];
    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    const actors: BookingActor[] = [];
    if (existing.owner_id === callerId) actors.push('host');
    if (existing.user_id === callerId) actors.push('guest');
    if (actors.length === 0) {
      throw new ForbiddenException();
    }

    // first check: can this actor ever set this status?
    const targetsForActor = (actor: BookingActor) =>
      Object.values(ALLOWED_TRANSITIONS[actor]).flat();
    if (!actors.some((a) => targetsForActor(a).includes(status))) {
      throw new ForbiddenException(`You cannot set a booking to '${status}'`);
    }
    // second check: allowed transition for the current status
    const allowedStatusChanges = (actor: BookingActor) =>
      getAllowedStatusChanges(
        actor,
        existing.status,
        formatDateOnly(existing.check_in),
        formatDateOnly(existing.check_out),
        formatDateOnly(new Date()),
      );
    if (!actors.some((a) => allowedStatusChanges(a).includes(status))) {
      throw new ConflictException(
        `Cannot change a '${existing.status}' booking to '${status}'`,
      );
    }

    // `AND status = $3` makes the transition atomic: if the status changed
    // between the read above and this write, nothing is updated.
    const result = await this.pool.query<BookingRow>(
      /*sql*/ `UPDATE bookings SET status = $1, updated_at = now()
        WHERE id = $2 AND status = $3
        RETURNING *`,
      [status, id, existing.status],
    );
    const row = result.rows[0];
    if (!row) {
      throw new ConflictException('Booking status changed, please retry');
    }
    const booking = toBookingDto(row);

    if (status === BookingStatus.Confirmed) {
      // Fire-and-forget, same as the email/analytics side effects in
      // create() — a slow or failing push shouldn't hold up the response.
      this.firebasePushService
        .sendToUser(booking.userId, {
          title: 'Booking confirmed',
          body: 'Booking confirmed by host',
          data: { url: `hotels://booking/${booking.id}` },
        })
        .catch((err: unknown) =>
          console.error(
            `Failed to send push notification for booking ${booking.id}`,
            err,
          ),
        );
    }

    return booking;
  }

  async remove(id: string): Promise<void> {
    const result = await this.pool.query('DELETE FROM bookings WHERE id = $1', [
      id,
    ]);
    if (result.rowCount === 0) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }
  }

  async removeSynthetic(): Promise<{ deletedCount: number }> {
    const result = await this.pool.query(
      'DELETE FROM bookings WHERE is_synthetic = true',
    );
    return { deletedCount: result.rowCount ?? 0 };
  }
}
