import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { Test, TestingModule } from '@nestjs/testing';
import { HotelsService } from './hotels.service';
import { PG_POOL } from '../db/database.module';

type QueryResult = { rows: any[] };

const row = (id: string) => ({
  id,
  name: `Hotel ${id}`,
  description: 'desc',
  location: 'Somewhere',
  latitude: 41.38,
  longitude: 2.17,
});

describe('HotelsService', () => {
  let service: HotelsService;
  let pool: {
    query: Mock<(sql: string, params: any[]) => Promise<QueryResult>>;
  };

  beforeEach(async () => {
    pool = {
      query: jest.fn<(sql: string, params: any[]) => Promise<QueryResult>>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HotelsService, { provide: PG_POOL, useValue: pool }],
    }).compile();

    service = module.get(HotelsService);
  });

  // findNearest fires two queries in parallel (page + count), so tell them
  // apart by their SQL instead of relying on call order.
  function mockNearestQueries(rows: any[], total: number) {
    pool.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('COUNT(*)') ? { rows: [{ total }] } : { rows },
      ),
    );
  }

  const pageCall = () =>
    pool.query.mock.calls.find(([sql]) => !sql.includes('COUNT(*)'))!;
  const countCall = () =>
    pool.query.mock.calls.find(([sql]) => sql.includes('COUNT(*)'))!;

  describe('findNearest', () => {
    it('defaults to page 1, pageSize 20 and passes lng/lat in that order', async () => {
      mockNearestQueries([], 0);

      await service.findNearest(2.17, 41.38);

      // $1 = longitude, $2 = latitude (ST_Point takes x=lng, y=lat), $3 = LIMIT, $4 = OFFSET
      expect(pageCall()[1]).toEqual([2.17, 41.38, 20, 0]);
      expect(countCall()[1]).toEqual([2.17, 41.38]);
    });

    it('converts page and pageSize into LIMIT/OFFSET', async () => {
      mockNearestQueries([], 0);

      await service.findNearest(2.17, 41.38, 3, 10);

      expect(pageCall()[1]).toEqual([2.17, 41.38, 10, 20]);
    });

    it('orders by distance with id as a tiebreaker so paging is stable', async () => {
      mockNearestQueries([], 0);

      await service.findNearest(2.17, 41.38);

      expect(pageCall()[0]).toMatch(/ORDER BY .*<->.*,\s*id/s);
    });

    it('applies the same radius filter to the page and the count queries', async () => {
      mockNearestQueries([], 0);

      await service.findNearest(2.17, 41.38);

      const radius = (sql: string) => sql.match(/ST_DWITHIN\([^)]*\)/i)?.[0];
      expect(radius(pageCall()[0])).toBeDefined();
      expect(radius(pageCall()[0])).toBe(radius(countCall()[0]));
    });

    it('maps rows to HotelDtos and returns pagination meta', async () => {
      mockNearestQueries([row('a'), row('b')], 45);

      const result = await service.findNearest(2.17, 41.38, 2, 20);

      expect(result.data.map((h) => h.id)).toEqual(['a', 'b']);
      expect(result.data[0].geo).toEqual({ latitude: 41.38, longitude: 2.17 });
      expect(result.meta.pagination).toEqual({
        page: 2,
        pageSize: 20,
        pageCount: 3, // ceil(45 / 20)
        total: 45,
      });
    });

    it('selects the distance and exposes it as rounded distanceMeters', async () => {
      mockNearestQueries([{ ...row('a'), distance_m: 1234.56 }, row('b')], 2);

      const result = await service.findNearest(2.17, 41.38);

      expect(pageCall()[0]).toMatch(/ST_Distance\(.*\)\s+AS distance_m/is);
      expect(result.data[0].distanceMeters).toBe(1235);
      // rows without a distance (e.g. from findAll) don't get the field at all
      expect(result.data[1]).not.toHaveProperty('distanceMeters');
    });

    it('returns an empty page with pageCount 0 when nothing is in range', async () => {
      mockNearestQueries([], 0);

      const result = await service.findNearest(0, 0);

      expect(result.data).toEqual([]);
      expect(result.meta.pagination).toEqual({
        page: 1,
        pageSize: 20,
        pageCount: 0,
        total: 0,
      });
    });

    it('falls back to total 0 if the count query returns no row', async () => {
      pool.query.mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes('COUNT(*)') ? { rows: [] } : { rows: [row('a')] },
        ),
      );

      const result = await service.findNearest(2.17, 41.38);

      expect(result.meta.pagination.total).toBe(0);
      expect(result.meta.pagination.pageCount).toBe(0);
    });
  });
});
