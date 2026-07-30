import { DocumentBuilder } from '@nestjs/swagger';

export function buildOpenApiDocument() {
  return new DocumentBuilder()
    .setTitle('Hotels API')
    .setDescription('Public API contract for the Hotels app')
    .setVersion('1.0')
    .build();
}
