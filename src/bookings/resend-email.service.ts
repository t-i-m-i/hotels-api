import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { BookingNotificationDetails } from './booking-notification.service';

@Injectable()
export class ResendEmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendBookingConfirmationEmail(details: BookingNotificationDetails) {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not set — skipping confirmation email for booking ${details.bookingId}`,
      );
      return;
    }

    await this.resend.emails.send({
      from: 'Hotels Demo <onboarding@resend.dev>',
      to: details.userEmail,
      subject: `Your booking at ${details.hotelName} is confirmed`,
      html: `<p>Hi ${details.userFirstName},</p>
        <p>Your booking at <strong>${details.hotelName}</strong> is confirmed
        for ${details.checkIn.toDateString()} to ${details.checkOut.toDateString()}.</p>`,
    });

    this.logger.log(`Sent confirmation email for booking ${details.bookingId}`);
  }
}
