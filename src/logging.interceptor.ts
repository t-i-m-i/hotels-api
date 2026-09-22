// Logs both the incoming request and outgoing response (method, url,
// headers, body/status) for any route it's applied to via @UseInterceptors.
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor<T> implements NestInterceptor<T, T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<T> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    console.log({
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body as unknown,
    });

    return next.handle().pipe(
      tap((body: T) => {
        console.log({
          statusCode: res.statusCode,
          headers: res.getHeaders(),
          body,
        });
      }),
    );
  }
}
