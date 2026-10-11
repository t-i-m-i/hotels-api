import { BookingStatus } from './booking-status.enum';

export type BookingActor = 'guest' | 'host';

// Which status changes each actor may make through PATCH /bookings/:id/status,
// keyed by the booking's current (effective) status. `completed` appears
// nowhere as a target: it is derived from dates, never set by a client.
// A status with no entry is terminal.
export const ALLOWED_TRANSITIONS: Record<
  BookingActor,
  Partial<Record<BookingStatus, BookingStatus[]>>
> = {
  guest: {
    [BookingStatus.Pending]: [BookingStatus.Cancelled],
    [BookingStatus.Confirmed]: [BookingStatus.Cancelled],
  },
  host: {
    [BookingStatus.Pending]: [BookingStatus.Confirmed, BookingStatus.Cancelled],
    [BookingStatus.Confirmed]: [BookingStatus.Cancelled, BookingStatus.NoShow],
  },
};

// SQL that turns a stored `confirmed` booking into `completed` once its
// check-out date has passed. Used in every read so no cron has to write it.
export const effectiveStatusSql = (
  alias: string,
) => /*sql*/ `CASE WHEN ${alias}.status = 'confirmed' AND ${alias}.check_out < CURRENT_DATE
    THEN 'completed' ELSE ${alias}.status END`;
