import { BookingStatus } from './booking-status.enum';
import { getAllowedStatusChanges } from './booking-status-transitions';

const today = '2026-09-10';
const yesterday = '2026-09-09';
const tomorrow = '2026-09-11';

describe('getAllowedStatusChanges', () => {
  it('lets the host confirm or cancel an upcoming pending booking', () => {
    expect(
      getAllowedStatusChanges(
        'host',
        BookingStatus.Pending,
        tomorrow,
        '2026-09-15',
        today,
      ),
    ).toEqual([BookingStatus.Confirmed, BookingStatus.Cancelled]);
  });

  it('lets the guest only cancel a pending or confirmed booking', () => {
    for (const status of [BookingStatus.Pending, BookingStatus.Confirmed]) {
      expect(
        getAllowedStatusChanges('guest', status, tomorrow, '2026-09-15', today),
      ).toEqual([BookingStatus.Cancelled]);
    }
  });

  it('drops no_show for a confirmed booking that has not started', () => {
    expect(
      getAllowedStatusChanges(
        'host',
        BookingStatus.Confirmed,
        tomorrow,
        '2026-09-15',
        today,
      ),
    ).toEqual([BookingStatus.Cancelled]);
  });

  it('allows no_show on the check-in day and while staying', () => {
    for (const checkIn of [today, yesterday]) {
      expect(
        getAllowedStatusChanges(
          'host',
          BookingStatus.Confirmed,
          checkIn,
          '2026-09-15',
          today,
        ),
      ).toEqual([BookingStatus.Cancelled, BookingStatus.NoShow]);
    }
  });

  it('still allows changes on the check-out day', () => {
    expect(
      getAllowedStatusChanges(
        'host',
        BookingStatus.Confirmed,
        yesterday,
        today,
        today,
      ),
    ).toEqual([BookingStatus.Cancelled, BookingStatus.NoShow]);
  });

  it('allows nothing once check-out has passed, even for a pending booking', () => {
    expect(
      getAllowedStatusChanges(
        'host',
        BookingStatus.Pending,
        '2026-09-01',
        yesterday,
        today,
      ),
    ).toEqual([]);
  });

  it.each([
    BookingStatus.Cancelled,
    BookingStatus.NoShow,
    BookingStatus.Completed,
  ])('allows nothing from terminal status %s', (status) => {
    for (const actor of ['guest', 'host'] as const) {
      expect(
        getAllowedStatusChanges(actor, status, yesterday, tomorrow, today),
      ).toEqual([]);
    }
  });
});
