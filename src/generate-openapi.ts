import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi-document';

const OUTPUT_PATH = join(__dirname, '..', 'docs', 'openapi.json');

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = SwaggerModule.createDocument(app, buildOpenApiDocument());

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(document, null, 2));

  await app.close();
  console.log(`OpenAPI spec written to ${OUTPUT_PATH}`);
}

generate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
