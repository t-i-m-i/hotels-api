import { ApiProperty } from '@nestjs/swagger';
import { HotelDto } from './hotel.dto';

export class PaginationDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  pageSize: number;

  @ApiProperty({ example: 5 })
  pageCount: number;

  @ApiProperty({ example: 87 })
  total: number;
}

export class HotelsMetaDto {
  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}

export class PaginatedHotelsDto {
  @ApiProperty({ type: HotelDto, isArray: true })
  data: HotelDto[];

  @ApiProperty({ type: HotelsMetaDto })
  meta: HotelsMetaDto;
}
