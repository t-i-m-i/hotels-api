import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { EMAIL_QUEUE } from '../bookings/bookings.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    BullBoardModule.forRoot({ route: '/queues', adapter: ExpressAdapter }),
    BullBoardModule.forFeature({ name: EMAIL_QUEUE, adapter: BullAdapter }),
  ],
})
export class QueueBoardModule {}
