import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { EMAIL_QUEUE } from './bookings.constants';
import { BookingNotificationService } from './booking-notification.service';
import { ResendEmailService } from './resend-email.service';
import { BookingAnalyticsListener } from './listeners/booking-analytics.listener';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
    PushNotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [
    BookingsService,
    BookingNotificationService,
    ResendEmailService,
    BookingAnalyticsListener,
    EmailQueueProcessor,
  ],
})
export class BookingsModule {}
