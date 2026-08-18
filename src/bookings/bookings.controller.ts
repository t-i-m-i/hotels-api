import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import {
  ApiTags,
  ApiCreatedResponse,
  ApiOkResponse,
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
  remove(@Param('id') id: string) {
    return this.bookingsService.remove(id);
  }
}
