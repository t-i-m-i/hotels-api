import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListHotelsQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive filter matched against name and location',
    example: 'Barcelona',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

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
