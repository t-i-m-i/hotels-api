import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth';
import { AuthLoggingHook } from './auth/auth-logging.hook';
import { MeModule } from './auth/me.module';
import { DatabaseModule } from './db/database.module';
import { QueueModule } from './queue/queue.module';
import { QueueBoardModule } from './queue/bull-board.module';
import { HotelsModule } from './hotels/hotels.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    AuthModule.forRoot({ auth }),
    MeModule,
    DatabaseModule,
    QueueModule,
    QueueBoardModule,
    HotelsModule,
    BookingsModule,
  ],
  // Comment out AuthLoggingHook to disable it outright without touching
  // .env — see src/auth/auth-logging.hook.ts for the AUTH_DEBUG_LOGGING
  // env-var switch, the normal way to toggle it on/off while developing.
  providers: [AuthLoggingHook],
})
export class AppModule {}
