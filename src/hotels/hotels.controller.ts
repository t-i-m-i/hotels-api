import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HotelDto } from './dto/hotel.dto';
import { ListHotelsQueryDto } from './dto/list-hotels-query.dto';
import { HotelsService } from './hotels.service';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get()
  @ApiOkResponse({ type: HotelDto, isArray: true })
  findAll(@Query() query: ListHotelsQueryDto): Promise<HotelDto[]> {
    return this.hotelsService.findAll(query.search);
  }

  @Get(':id')
  @ApiOkResponse({ type: HotelDto })
  @ApiNotFoundResponse({
    description: 'Hotel with the given id does not exist',
  })
  findOne(@Param('id') id: string): Promise<HotelDto> {
    return this.hotelsService.findOne(id);
  }
}
