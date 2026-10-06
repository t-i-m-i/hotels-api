import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi-document';

async function bootstrap() {
  // @thallesp/nestjs-better-auth needs the raw request body for its own
  // routes; it re-adds body parsing for every other route.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // One line per request: "GET /hotels/nearest?... 200 12ms". Plain Express
  // middleware (not an interceptor) so it also covers BetterAuth's raw routes,
  // 404s and guard/validation failures. No headers or bodies on purpose.
  // Registered before listen() so it runs ahead of every route.
  if (process.env.NODE_ENV !== 'production') {
    const httpLogger = new Logger('HTTP');
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        httpLogger.log(
          `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`,
        );
      });
      next();
    });
  }

  app.enableCors();
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const document = SwaggerModule.createDocument(app, buildOpenApiDocument());
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
