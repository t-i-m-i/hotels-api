import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './db/database.module';
import { QueueModule } from './queue/queue.module';
import { QueueBoardModule } from './queue/bull-board.module';
import { HotelsModule } from './hotels/hotels.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    QueueModule,
    QueueBoardModule,
    HotelsModule,
    BookingsModule,
  ],
})
export class AppModule {}
