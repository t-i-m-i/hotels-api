import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude } from 'class-validator';

export class GeoDto {
  @ApiProperty({ example: 41.3851, minimum: -90, maximum: 90 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 2.1734, minimum: -180, maximum: 180 })
  @IsLongitude()
  longitude!: number;
}

export class HotelImageDto {
  @ApiProperty({
    example: 'hotels/shared/01.jpg',
    description:
      'Storage key, relative to the configured storage/CDN base URL. The client resolves it as `${STORAGE_URL}/${path}`.',
  })
  path!: string;

  @ApiProperty({ example: 'Hotel Barcino Central — photo 1' })
  alt!: string;

  @ApiProperty({ example: 1600, description: 'Intrinsic width in pixels.' })
  width!: number;

  @ApiProperty({ example: 1067, description: 'Intrinsic height in pixels.' })
  height!: number;
}

export class HotelDto {
  @ApiProperty({ example: '1' })
  id!: string;

  @ApiProperty({ example: 'Hotel Barcino Central' })
  name!: string;

  @ApiProperty({
    example:
      'A boutique hotel steps away from Las Ramblas, blending Gothic Quarter charm with modern comfort.',
  })
  description!: string;

  @ApiProperty({ example: 'Barcelona, Spain' })
  location!: string;

  @ApiProperty({ type: GeoDto })
  geo!: GeoDto;

  @ApiProperty({
    type: [HotelImageDto],
    description:
      'Gallery images for the hotel, in display order. First entry is the cover.',
  })
  images!: HotelImageDto[];
}
