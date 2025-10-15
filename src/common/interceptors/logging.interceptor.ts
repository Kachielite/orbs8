import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import logger from '../utils/logger/logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const res: Response = context.switchToHttp().getResponse();
        const { statusCode } = res;
        const time = Date.now() - start;

        logger.info({
          message: 'Request handled',
          method,
          url,
          statusCode,
          responseTime: `${time}ms`,
        });
      }),
    );
  }
}
