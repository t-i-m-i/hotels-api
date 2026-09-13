import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';

export class HotelsWithinBoundsQueryDto {
  @ApiProperty({ example: 41.0, description: 'South-west corner latitude' })
  @Type(() => Number) // "41.0" -> 41.0 (query params are strings)
  @IsNumber()
  @Min(-90)
  @Max(90)
  swLat!: number;

  @ApiProperty({ example: 2.0, description: 'South-west corner longitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  swLng!: number;

  @ApiProperty({ example: 41.6, description: 'North-east corner latitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  neLat!: number;

  @ApiProperty({ example: 2.4, description: 'North-east corner longitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  neLng!: number;
}
