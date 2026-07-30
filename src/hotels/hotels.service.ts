import { Injectable, NotFoundException } from '@nestjs/common';
import { HotelDto } from './dto/hotel.dto';

const MOCK_HOTELS: HotelDto[] = [
  {
    id: '1',
    name: 'Hotel Barcino Central',
    description:
      'A boutique hotel steps away from Las Ramblas, blending Gothic Quarter charm with modern comfort.',
    location: 'Barcelona, Spain',
    geo: { latitude: 41.3851, longitude: 2.1734 },
  },
  {
    id: '2',
    name: 'Costa del Sol Suites',
    description:
      "Bright, breezy rooms near Málaga's old town, a short walk from the beach and cathedral.",
    location: 'Málaga, Spain',
    geo: { latitude: 36.7213, longitude: -4.4214 },
  },
  {
    id: '3',
    name: 'Palazzo Roma',
    description:
      'Classic Roman elegance minutes from the Trevi Fountain and the Pantheon.',
    location: 'Rome, Italy',
    geo: { latitude: 41.9028, longitude: 12.4964 },
  },
  {
    id: '4',
    name: 'Verona Arena View',
    description:
      "Cozy rooms overlooking Verona's Roman arena, in the heart of Romeo and Juliet's city.",
    location: 'Verona, Italy',
    geo: { latitude: 45.4384, longitude: 10.9916 },
  },
  {
    id: '5',
    name: 'Alpenblick Salzburg',
    description:
      'A charming stay by the Salzach river with views of the Hohensalzburg Fortress.',
    location: 'Salzburg, Austria',
    geo: { latitude: 47.8095, longitude: 13.055 },
  },
];

@Injectable()
export class HotelsService {
  findAll(search?: string): HotelDto[] {
    if (!search) {
      return MOCK_HOTELS;
    }

    const needle = search.toLowerCase();
    return MOCK_HOTELS.filter(
      (hotel) =>
        hotel.name.toLowerCase().includes(needle) ||
        hotel.location.toLowerCase().includes(needle),
    );
  }

  findOne(id: string): HotelDto {
    const hotel = MOCK_HOTELS.find((h) => h.id === id);
    if (!hotel) {
      throw new NotFoundException(`Hotel with id "${id}" not found`);
    }
    return hotel;
  }
}
