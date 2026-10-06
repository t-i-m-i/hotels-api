import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class NearestHotelsQueryDto {
  @ApiProperty({ example: 2.17, description: 'Longitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ example: 41.38, description: 'Latitude' })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number) //  converts "1" → 1
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 80,
  })
  @IsOptional()
  @Type(() => Number) //  converts "20" → 20
  @IsInt()
  @Min(1)
  @Max(80)
  pageSize?: number;
}
