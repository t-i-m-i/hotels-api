import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { BookingDetailsDto, BookingDto } from './dto/booking.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiCreatedResponse({ type: BookingDto })
  create(@Body() createBookingDto: CreateBookingDto): Promise<BookingDto> {
    return this.bookingsService.create(createBookingDto);
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

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Booking not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bookingsService.remove(id);
  }
}
