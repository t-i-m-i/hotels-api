import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi-document';

async function bootstrap() {
  // @thallesp/nestjs-better-auth needs the raw request body for its own
  // routes; it re-adds body parsing for every other route.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const document = SwaggerModule.createDocument(app, buildOpenApiDocument());
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
