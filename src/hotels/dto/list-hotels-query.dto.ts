import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ListHotelsQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive filter matched against name and location',
    example: 'Barcelona',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
