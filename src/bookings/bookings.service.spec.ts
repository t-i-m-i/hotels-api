import { jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
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
          useValue: { sendToUser: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
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
});
