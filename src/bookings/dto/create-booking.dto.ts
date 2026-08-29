import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ example: '38dca5bd-0417-4971-baee-056e1aa3ce21' })
  @IsUUID()
  hotelId!: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsDateString()
  checkIn!: string;

  @ApiProperty({ example: '2026-09-10' })
  @IsDateString()
  checkOut!: string;
}
