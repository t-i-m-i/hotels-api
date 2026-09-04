import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  ApiTags,
  ApiHeader,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { BookingDetailsDto, BookingDto } from './dto/booking.dto';
import { DeleteSyntheticBookingsDto } from './dto/delete-synthetic-bookings.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiHeader({
    name: 'x-synthetic-booking',
    required: false,
    description:
      'Set to "true" to tag this booking as test data created by an automated e2e suite, rather than a real reservation. Synthetic bookings are excluded from nothing at read time — they behave like any other booking — but can be bulk-deleted via DELETE /bookings/synthetic.',
  })
  @ApiCreatedResponse({ type: BookingDto })
  create(
    @Body() createBookingDto: CreateBookingDto,
    @Headers('x-synthetic-booking') syntheticHeader?: string,
  ): Promise<BookingDto> {
    return this.bookingsService.create(
      createBookingDto,
      syntheticHeader === 'true',
    );
  }

  @Get()
  @ApiOkResponse({ type: BookingDetailsDto, isArray: true })
  findAll(): Promise<BookingDetailsDto[]> {
    return this.bookingsService.findAll();
  }

  @Get('hotel/:hotelId')
  @ApiOkResponse({ type: BookingDto, isArray: true })
  findCurrentByHotel(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ): Promise<BookingDto[]> {
    return this.bookingsService.findCurrentByHotel(hotelId);
  }

  @Get('user/:userId')
  @ApiOkResponse({ type: BookingDetailsDto, isArray: true })
  getBookingsByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<BookingDetailsDto[]> {
    return this.bookingsService.getBookingsByUser(userId);
  }

  @Get(':id')
  @ApiOkResponse({ type: BookingDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  findOne(@Param('id') id: string): Promise<BookingDto> {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  // Declared before `:id` — Nest matches routes in order, so this literal
  // segment has to come first or `DELETE /bookings/synthetic` would be
  // swallowed by `remove()` below with id="synthetic".
  @Delete('synthetic')
  @ApiOkResponse({ type: DeleteSyntheticBookingsDto })
  removeSynthetic(): Promise<DeleteSyntheticBookingsDto> {
    return this.bookingsService.removeSynthetic();
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Booking not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bookingsService.remove(id);
  }
}
