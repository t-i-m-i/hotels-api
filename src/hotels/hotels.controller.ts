import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { HotelDto } from './dto/hotel.dto';
import { ListHotelsQueryDto } from './dto/list-hotels-query.dto';
import { PaginatedHotelsDto } from './dto/paginated-hotels.dto';
import { HotelsService } from './hotels.service';
import { HotelsWithinBoundsQueryDto } from './dto/hotels-within-bounds-query.dto';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiOkResponse({ type: PaginatedHotelsDto })
  findAll(@Query() query: ListHotelsQueryDto): Promise<PaginatedHotelsDto> {
    return this.hotelsService.findAll(query.search, query.page, query.pageSize);
  }

  @Get('within-bounds')
  @ApiOkResponse({ type: HotelDto, isArray: true })
  findWithinBounds(
    @Query() query: HotelsWithinBoundsQueryDto,
  ): Promise<HotelDto[]> {
    return this.hotelsService.findWithinBounds(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: HotelDto })
  @ApiNotFoundResponse({
    description: 'Hotel with the given id does not exist',
  })
  @ApiBadRequestResponse({ description: 'id is not a valid UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<HotelDto> {
    return this.hotelsService.findOne(id);
  }
}
