import { ApiProperty } from '@nestjs/swagger';

export class DeleteSyntheticBookingsDto {
  @ApiProperty({ example: 3, description: 'Number of synthetic bookings deleted' })
  deletedCount!: number;
}
