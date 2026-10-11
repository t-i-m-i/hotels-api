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
  // UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import type { UserSession } from '@thallesp/nestjs-better-auth';
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
  ApiParam,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import {
  BookingDetailsDto,
  BookingDto,
  HostHotelBookingsDto,
} from './dto/booking.dto';
import { DeleteSyntheticBookingsDto } from './dto/delete-synthetic-bookings.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
// import { LoggingInterceptor } from 'src/logging.interceptor';

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
    @Session() session: UserSession,
    @Headers('x-synthetic-booking') syntheticHeader?: string,
  ): Promise<BookingDto> {
    return this.bookingsService.create(
      createBookingDto,
      session.user.id,
      syntheticHeader === 'true',
    );
  }

  @Get()
  @ApiOkResponse({ type: BookingDetailsDto, isArray: true })
  @AllowAnonymous()
  findAll(): Promise<BookingDetailsDto[]> {
    return this.bookingsService.findAll();
  }

  @Get('hotel/:hotelId')
  @ApiParam({ name: 'hotelId', format: 'uuid' })
  @ApiOkResponse({ type: BookingDto, isArray: true })
  @ApiBadRequestResponse({ description: 'id is not a valid UUID' })
  @AllowAnonymous()
  findCurrentByHotel(
    @Param('hotelId', ParseUUIDPipe) hotelId: string,
  ): Promise<BookingDto[]> {
    return this.bookingsService.findCurrentByHotel(hotelId);
  }

  @Get('user/:userId')
  @ApiOkResponse({ type: BookingDetailsDto, isArray: true })
  // @UseInterceptors(LoggingInterceptor)
  getBookingsByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Session() session: UserSession,
  ): Promise<BookingDetailsDto[]> {
    if (userId !== session.user.id) {
      throw new ForbiddenException();
    }
    return this.bookingsService.getBookingsByUser(userId);
  }

  @Get('host/:hostId')
  @ApiOkResponse({ type: HostHotelBookingsDto, isArray: true })
  getByHost(
    @Param('hostId', ParseUUIDPipe) hostId: string,
    @Session() session: UserSession,
  ): Promise<HostHotelBookingsDto[]> {
    if (hostId !== session.user.id) {
      throw new ForbiddenException();
    }
    return this.bookingsService.getByHost(hostId);
  }

  @Get(':id')
  @ApiOkResponse({ type: BookingDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @AllowAnonymous()
  findOne(@Param('id') id: string): Promise<BookingDto> {
    return this.bookingsService.findOne(id);
  }

  @Patch(':id')
  @AllowAnonymous()
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingsService.update(id, updateBookingDto);
  }

  @Patch(':id/status')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BookingDto })
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @ApiForbiddenResponse({
    description:
      'Caller is neither the guest nor the hotel owner, or may not set this status',
  })
  @ApiConflictResponse({
    description: 'Transition not allowed from the booking’s current state',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBookingStatusDto: UpdateBookingStatusDto,
    @Session() session: UserSession,
  ): Promise<BookingDto> {
    return this.bookingsService.updateStatus(
      id,
      updateBookingStatusDto.status,
      session.user.id,
    );
  }

  // Declared before `:id` — Nest matches routes in order, so this literal
  // segment has to come first or `DELETE /bookings/synthetic` would be
  // swallowed by `remove()` below with id="synthetic".
  @Delete('synthetic')
  @ApiOkResponse({ type: DeleteSyntheticBookingsDto })
  @AllowAnonymous()
  removeSynthetic(): Promise<DeleteSyntheticBookingsDto> {
    return this.bookingsService.removeSynthetic();
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Booking not found' })
  @AllowAnonymous()
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bookingsService.remove(id);
  }
}
