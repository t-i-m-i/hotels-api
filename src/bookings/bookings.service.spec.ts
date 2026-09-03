import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingsService } from './bookings.service';
import { PG_POOL } from '../db/database.module';
import { EMAIL_QUEUE } from './bookings.constants';

describe('BookingsService', () => {
  let service: BookingsService;
  let pool: { query: jest.Mock };

  beforeEach(async () => {
    // A fake stand-in for the real pg Pool — just enough shape (a `query`
    // method) for BookingsService to call, fully controlled by each test.
    pool = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PG_POOL, useValue: pool },
        { provide: getQueueToken(EMAIL_QUEUE), useValue: { add: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
