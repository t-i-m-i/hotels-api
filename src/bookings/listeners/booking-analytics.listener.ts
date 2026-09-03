import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BookingCreatedEvent } from '../events/booking-created.event';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class BookingAnalyticsListener {
  private readonly logger = new Logger(BookingAnalyticsListener.name);

  @OnEvent('booking.created')
  async handleBookingCreated(event: BookingCreatedEvent) {
    await sleep(1000);
    this.logger.log(
      `[analytics] booking.created id=${event.bookingId} hotel=${event.hotelId} user=${event.userId}`,
    );
  }
}
