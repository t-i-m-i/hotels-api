import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';

export type BookingNotificationDetails = {
  bookingId: string;
  checkIn: Date;
  checkOut: Date;
  hotelName: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
};

type BookingNotificationRow = {
  id: string;
  check_in: Date;
  check_out: Date;
  hotel_name: string;
  first_name: string;
  last_name: string;
  email: string;
};

@Injectable()
export class BookingNotificationService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getDetails(bookingId: string): Promise<BookingNotificationDetails> {
    const result = await this.pool.query<BookingNotificationRow>(
      /*sql*/ `SELECT b.id, b.check_in, b.check_out, h.name as hotel_name,
        u.first_name, u.last_name, u.email
        FROM bookings b
        INNER JOIN hotels h ON h.id = b.hotel_id
        INNER JOIN users u ON u.id = b.user_id
        WHERE b.id = $1`,
      [bookingId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Booking with id ${bookingId} not found`);
    }
    return {
      bookingId: row.id,
      checkIn: row.check_in,
      checkOut: row.check_out,
      hotelName: row.hotel_name,
      userFirstName: row.first_name,
      userLastName: row.last_name,
      userEmail: row.email,
    };
  }
}
