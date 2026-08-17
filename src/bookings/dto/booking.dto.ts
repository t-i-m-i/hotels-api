import { ApiProperty } from '@nestjs/swagger';

export class BookingDto {
  @ApiProperty({ example: '38dca5bd-0417-4971-baee-056e1aa3ce21' })
  id!: string;

  @ApiProperty({ example: 'bf721a73-1a8b-4de2-b74b-a747e1197d3f' })
  userId!: string;

  @ApiProperty({ example: '38dca5bd-0417-4971-baee-056e1aa3ce21' })
  hotelId!: string;

  @ApiProperty({ example: '2026-09-01' })
  checkIn!: string;

  @ApiProperty({ example: '2026-09-10' })
  checkOut!: string;
}
