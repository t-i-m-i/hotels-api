import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsString, IsUUID } from 'class-validator';

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

  // TODO add first new fields from the group of fields that will extend bookings table finally. First phase we add names and email as this data can be empty after registration
  // - we can prefill the form on the frontend if these fields are not empty
  // - we allow to add different data then registered user data - I think
  // - as this is a snapshot we do not update that data in user table but store it just in bookings table
  @ApiProperty({ example: 'John' })
  @IsString()
  guestFirstName!: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  guestLastName!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  guestEmail!: string;
}
