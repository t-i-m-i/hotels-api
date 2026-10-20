import { jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingsService } from './bookings.service';
import { PG_POOL } from '../db/database.module';
import { EMAIL_QUEUE } from './bookings.constants';
import { FirebasePushService } from '../push-notifications/firebase-push.service';

describe('BookingsService', () => {
  let service: BookingsService;
  let pool: { query: Mock<(...args: any[]) => Promise<{ rows: any[] }>> };

  beforeEach(async () => {
    // A fake stand-in for the real pg Pool — just enough shape (a `query`
    // method) for BookingsService to call, fully controlled by each test.
    pool = { query: jest.fn<(...args: any[]) => Promise<{ rows: any[] }>>() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PG_POOL, useValue: pool },
        { provide: getQueueToken(EMAIL_QUEUE), useValue: { add: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: FirebasePushService,
          useValue: {
            sendToUser: jest.fn<() => Promise<void>>().mockResolvedValue(),
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getByHost', () => {
    // Rows as pg returns them for the getByHost query: one row per booking,
    // hotel columns repeated on every row. Dates are local-midnight Dates,
    // matching how formatDateOnly reads them.
    const bookingRow = (
      id: string,
      hotelId: string,
      hotelName: string,
      checkIn: Date,
      checkOut: Date,
      overrides: Record<string, unknown> = {},
    ) => ({
      id,
      check_in: checkIn,
      check_out: checkOut,
      status: 'pending',
      hotel_id: hotelId,
      hotel_name: hotelName,
      first_name: 'Diego',
      last_name: 'Alvarez',
      ...overrides,
    });

    it('queries by the given host id', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await service.getByHost('host-1');

      expect(pool.query).toHaveBeenCalledTimes(1);
      expect(pool.query.mock.calls[0][1]).toEqual(['host-1']);
    });

    it('returns an empty array when the host has no bookings', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getByHost('host-1')).resolves.toEqual([]);
    });

    it('groups bookings by hotel instead of returning one group per booking', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          bookingRow(
            'b1',
            'h1',
            'Alpenblick',
            new Date(2026, 8, 13),
            new Date(2026, 8, 15),
          ),
          bookingRow(
            'b2',
            'h1',
            'Alpenblick',
            new Date(2026, 9, 1),
            new Date(2026, 9, 3),
          ),
          bookingRow(
            'b3',
            'h2',
            'Costa del Sol',
            new Date(2026, 7, 19),
            new Date(2026, 7, 26),
          ),
        ],
      });

      const result = await service.getByHost('host-1');

      expect(result).toHaveLength(2);
      expect(result.map((g) => g.hotelId)).toEqual(['h1', 'h2']);
      expect(result[0].bookings.map((b) => b.id)).toEqual(['b1', 'b2']);
      expect(result[1].bookings.map((b) => b.id)).toEqual(['b3']);
    });

    it('groups correctly even when a hotel’s rows are not adjacent', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          bookingRow(
            'b1',
            'h1',
            'A',
            new Date(2026, 8, 1),
            new Date(2026, 8, 2),
          ),
          bookingRow(
            'b2',
            'h2',
            'B',
            new Date(2026, 8, 3),
            new Date(2026, 8, 4),
          ),
          bookingRow(
            'b3',
            'h1',
            'A',
            new Date(2026, 8, 5),
            new Date(2026, 8, 6),
          ),
        ],
      });

      const result = await service.getByHost('host-1');

      expect(result).toHaveLength(2);
      expect(result[0].bookings.map((b) => b.id)).toEqual(['b1', 'b3']);
    });

    it('uses the hotel id (not the booking id) and maps booking fields to the DTO shape', async () => {
      // allowedStatusChanges depends on "today", so pin it to before check-in
      jest.useFakeTimers({ now: new Date(2026, 8, 10) });
      pool.query.mockResolvedValueOnce({
        rows: [
          bookingRow(
            'booking-1',
            'hotel-1',
            'Alpenblick',
            new Date(2026, 8, 13),
            new Date(2026, 8, 15),
            { status: 'confirmed' },
          ),
        ],
      });

      const result = await service.getByHost('host-1');

      expect(result).toEqual([
        {
          hotelId: 'hotel-1',
          hotelName: 'Alpenblick',
          bookings: [
            {
              id: 'booking-1',
              user: { firstName: 'Diego', lastName: 'Alvarez' },
              checkIn: '2026-09-13',
              checkOut: '2026-09-15',
              status: 'confirmed',
              allowedStatusChanges: ['cancelled'],
            },
          ],
        },
      ]);
    });
  });

  describe('assertNoOverlap', () => {
    it('throws BadRequestException when checkOut is not after checkIn, without querying the DB', async () => {
      await expect(
        (service as any).assertNoOverlap('hotel-1', '2026-09-10', '2026-09-10'),
      ).rejects.toThrow(BadRequestException);

      expect(pool.query).not.toHaveBeenCalled();
    });

    it('resolves without throwing when no existing booking overlaps', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        (service as any).assertNoOverlap('hotel-1', '2026-09-10', '2026-09-15'),
      ).resolves.toBeUndefined();

      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when an existing booking overlaps', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      await expect(
        (service as any).assertNoOverlap('hotel-1', '2026-09-10', '2026-09-15'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateStatus', () => {
    const past = new Date(2020, 0, 1);
    const future = new Date(2099, 0, 1);
    const current = (overrides: Record<string, unknown> = {}) => ({
      id: 'b1',
      user_id: 'guest-1',
      hotel_id: 'h1',
      owner_id: 'host-1',
      check_in: future,
      check_out: future,
      status: 'pending',
      ...overrides,
    });
    const arrange = (row: Record<string, unknown> | undefined) => {
      pool.query.mockResolvedValueOnce({ rows: row ? [row] : [] });
      pool.query.mockResolvedValueOnce({
        rows: [current({ ...row, status: 'updated' })],
      });
    };

    it('throws NotFound for an unknown booking', async () => {
      arrange(undefined);
      await expect(
        service.updateStatus('b1', 'cancelled' as any, 'host-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids a caller who is neither guest nor host', async () => {
      arrange(current());
      await expect(
        service.updateStatus('b1', 'cancelled' as any, 'stranger'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the host confirm a pending booking', async () => {
      arrange(current());
      await service.updateStatus('b1', 'confirmed' as any, 'host-1');
      expect(pool.query.mock.calls[1][1]).toEqual([
        'confirmed',
        'b1',
        'pending',
      ]);
    });

    it('forbids the guest from confirming', async () => {
      arrange(current());
      await expect(
        service.updateStatus('b1', 'confirmed' as any, 'guest-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the guest cancel a confirmed booking', async () => {
      arrange(current({ status: 'confirmed' }));
      await service.updateStatus('b1', 'cancelled' as any, 'guest-1');
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('forbids setting completed, even for the host', async () => {
      arrange(current({ status: 'confirmed' }));
      await expect(
        service.updateStatus('b1', 'completed' as any, 'host-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['cancelled', 'completed', 'no_show'])(
      'rejects any change from terminal status %s',
      async (status) => {
        arrange(current({ status }));
        await expect(
          service.updateStatus('b1', 'cancelled' as any, 'host-1'),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('rejects no_show on a pending booking', async () => {
      arrange(current());
      await expect(
        service.updateStatus('b1', 'no_show' as any, 'host-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects no_show before the check-in date', async () => {
      arrange(current({ status: 'confirmed' }));
      await expect(
        service.updateStatus('b1', 'no_show' as any, 'host-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows no_show once check-in has started', async () => {
      arrange(current({ status: 'confirmed', check_in: past }));
      await service.updateStatus('b1', 'no_show' as any, 'host-1');
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    it('conflicts when the status changed between read and write', async () => {
      pool.query.mockResolvedValueOnce({ rows: [current()] });
      pool.query.mockResolvedValueOnce({ rows: [] });
      await expect(
        service.updateStatus('b1', 'confirmed' as any, 'host-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
