import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Hotels (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Boots the *real* AppModule — real DatabaseModule, real Postgres
    // connection (whatever DATABASE_URL points to), real HotelsService.
    // Nothing is mocked here, unlike the assertNoOverlap unit test.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // main.ts's bootstrap() is never called in tests, so anything it sets
    // up on the app (global pipes, CORS, ...) has to be repeated here to
    // match what actually runs in dev/prod.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /hotels returns the seeded hotels', async () => {
    const response = await request(app.getHttpServer())
      .get('/hotels')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      location: expect.any(String),
      geo: {
        latitude: expect.any(Number),
        longitude: expect.any(Number),
      },
    });
  });

  it('GET /hotels/:id returns 404 for an id that does not exist', async () => {
    await request(app.getHttpServer())
      .get('/hotels/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});
