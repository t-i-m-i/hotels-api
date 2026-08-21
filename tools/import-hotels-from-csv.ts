/**
 * Import hotels from a CSV file into the `hotels` table.
 *
 * Skips rows whose `name` already exists in the table, so it's safe to
 * re-run against the same CSV (e.g. after fixing a bad row).
 *
 * Input CSV format (header row required, quoted fields supported):
 *   name,description,location,latitude,longitude,city,country
 *   "Grand Barcelona Hotel","A boutique hotel near...","Barcelona, Spain",41.3851,2.1734,Barcelona,Spain
 *
 * Usage:
 *   bun run tools/import-hotels-from-csv.ts tools/data/hotels.csv
 */

import { readFileSync } from 'fs';
import { Pool } from 'pg';

// ─── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = true; // set to false to actually write
// ─────────────────────────────────────────────────────────────────────────────

type HotelRow = {
  name: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
};

const REQUIRED_COLUMNS = [
  'name',
  'description',
  'location',
  'latitude',
  'longitude',
  'city',
  'country',
];

/** Splits a single CSV line into fields, honoring double-quoted fields with embedded commas/quotes. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);

  return fields;
}

function parseCSV(filePath: string): HotelRow[] {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    console.error('❌ CSV must have a header row and at least one data row');
    process.exit(1);
  }

  const [header, ...rows] = lines;
  const cols = splitCsvLine(header!).map((c) => c.trim());

  const missing = REQUIRED_COLUMNS.filter((c) => !cols.includes(c));
  if (missing.length > 0) {
    console.error(
      `❌ CSV header is missing required column(s): ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  const idx = Object.fromEntries(
    REQUIRED_COLUMNS.map((c) => [c, cols.indexOf(c)]),
  ) as Record<(typeof REQUIRED_COLUMNS)[number], number>;

  return rows.map((line, i) => {
    const cells = splitCsvLine(line);
    const name = cells[idx.name]?.trim() ?? '';
    const description = cells[idx.description]?.trim() ?? '';
    const location = cells[idx.location]?.trim() ?? '';
    const latitude = Number(cells[idx.latitude]?.trim());
    const longitude = Number(cells[idx.longitude]?.trim());
    const city = cells[idx.city]?.trim() ?? '';
    const country = cells[idx.country]?.trim() ?? '';

    if (
      !name ||
      !description ||
      !location ||
      !city ||
      !country ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude)
    ) {
      console.error(`❌ Row ${i + 2} is invalid: ${line}`);
      process.exit(1);
    }

    return { name, description, location, latitude, longitude, city, country };
  });
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error(
      '❌ Usage: bun run tools/import-hotels-from-csv.ts <path/to/hotels.csv>',
    );
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set (check your .env)');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log(`🚀 Import hotels from CSV${DRY_RUN ? ' [DRY RUN]' : ''}\n`);

  const hotels = parseCSV(csvPath);
  console.log(`📋 Parsed ${hotels.length} hotel(s) from CSV\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  try {
    for (const hotel of hotels) {
      try {
        const existing = await pool.query(
          'SELECT id FROM hotels WHERE name = $1',
          [hotel.name],
        );
        if (existing.rows.length > 0) {
          console.log(`⏭️  ${hotel.name} — already exists, skipping`);
          skipped++;
          continue;
        }

        if (DRY_RUN) {
          console.log(
            `🔍 [DRY RUN] Would create: ${hotel.name} (${hotel.city}, ${hotel.country})`,
          );
          created++;
          continue;
        }

        await pool.query(
          `INSERT INTO hotels (name, description, location, latitude, longitude, city, country)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            hotel.name,
            hotel.description,
            hotel.location,
            hotel.latitude,
            hotel.longitude,
            hotel.city,
            hotel.country,
          ],
        );
        console.log(`✅ Created: ${hotel.name}`);
        created++;
      } catch (err: unknown) {
        console.error(
          `❌ ${hotel.name} — error:`,
          err instanceof Error ? err.message : err,
        );
        errors++;
      }
    }
  } finally {
    await pool.end();
    console.log('\n🛑 Database connection closed');
  }

  console.log(`\n📊 Summary${DRY_RUN ? ' [DRY RUN — no writes]' : ''}:`);
  console.log(`   ✅ Created : ${created}`);
  console.log(`   ⏭️  Skipped : ${skipped}`);
  console.log(`   ❌ Errors  : ${errors}`);
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
