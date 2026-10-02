import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/database.module';
import { RegisterPushTokenDto } from './push-token.dto';

@Injectable()
export class PushTokensService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async register(dto: RegisterPushTokenDto): Promise<void> {
    // A token is unique per device, not per user — re-registering the same
    // device (reinstall, token refresh) should move it to whichever user is
    // currently signed in rather than erroring on the unique constraint.
    await this.pool.query(
      /*sql*/ `INSERT INTO device_push_tokens (user_id, token, platform)
        VALUES ($1, $2, $3)
        ON CONFLICT (token)
        DO UPDATE SET user_id = $1, platform = $3, updated_at = now()`,
      [dto.userId, dto.token, dto.platform],
    );
  }

  async getTokensForUser(userId: string): Promise<string[]> {
    const result = await this.pool.query<{ token: string }>(
      `SELECT token FROM device_push_tokens WHERE user_id = $1`,
      [userId],
    );
    return result.rows.map((row) => row.token);
  }

  async remove(token: string): Promise<void> {
    await this.pool.query('DELETE FROM device_push_tokens WHERE token = $1', [
      token,
    ]);
  }
}
