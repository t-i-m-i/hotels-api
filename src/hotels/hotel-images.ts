import { HotelImageDto } from './dto/hotel.dto';

/**
 * Demo stand-in for a real image service / CMS.
 *
 * In a production build these rows would come from an `images` table that an
 * admin populates when uploading to object storage, and each `path` would be a
 * genuine per-hotel key. Here we synthesise a deterministic, per-hotel list
 * (count and lead photo vary by hotel id) that all resolves to one shared
 * folder on the storage host — so the client never has to know the layout, it
 * just does `${STORAGE_URL}/${path}`.
 */

const SHARED_IMAGE_COUNT = 8;

// The shared photos are landscape 3:2 crops. Real per-image dimensions would be
// stored at upload time; a fixed ratio is enough to stop layout shift here.
const IMAGE_WIDTH = 1600;
const IMAGE_HEIGHT = 1067;

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function hotelImages(
  hotelId: string,
  hotelName: string,
): HotelImageDto[] {
  const seed = hashId(hotelId);
  const count = 4 + (seed % (SHARED_IMAGE_COUNT - 3)); // 4..8 photos
  const start = seed % SHARED_IMAGE_COUNT;

  return Array.from({ length: count }, (_, i) => {
    const n = ((start + i) % SHARED_IMAGE_COUNT) + 1;
    const file = String(n).padStart(2, '0');
    return {
      path: `hotels/shared/${file}.jpg`,
      alt: `${hotelName} — photo ${i + 1}`,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    };
  });
}
