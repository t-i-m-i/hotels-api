export class BookingCreatedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly userId: string,
    public readonly hotelId: string,
    public readonly checkIn: string,
    public readonly checkOut: string,
  ) {}
}
