import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { EMAIL_QUEUE } from '../bookings.constants';
import { BookingCreatedEvent } from '../events/booking-created.event';
import { BookingNotificationService } from '../booking-notification.service';
import { ResendEmailService } from '../resend-email.service';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Processor(EMAIL_QUEUE)
export class EmailQueueProcessor {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(
    private readonly notifications: BookingNotificationService,
    private readonly resendEmailService: ResendEmailService,
  ) {}

  @Process('send-confirmation-email')
  async handleSendConfirmationEmail(job: Job<BookingCreatedEvent>) {
    const details = await this.notifications.getDetails(job.data.bookingId);
    await this.resendEmailService.sendBookingConfirmationEmail(details);
  }

  @Process('generate-invoice')
  async handleGenerateInvoice(job: Job<BookingCreatedEvent>) {
    await sleep(2000);
    this.logger.log(
      `[invoice] generated PDF invoice for booking ${job.data.bookingId}`,
    );
  }
}
