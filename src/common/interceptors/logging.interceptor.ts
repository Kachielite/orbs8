import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import logger from '../utils/logger/logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();
    const { method, url } = req;
    const start = Date.now();

    const res: Response = context.switchToHttp().getResponse();

    const cleanup = () => {
      res.removeListener('finish', onFinish);
      res.removeListener('close', onClose);
    };

    const logRequest = () => {
      const { statusCode } = res;
      const time = Date.now() - start;

      logger.info({
        message: 'Request handled',
        method,
        url,
        statusCode,
        responseTime: `${time}ms`,
      });
    };

    const onFinish = () => {
      logRequest();
      cleanup();
    };

    const onClose = () => {
      // closed before finishing (client aborted) — still log
      logRequest();
      cleanup();
    };

    res.on('finish', onFinish);
    res.on('close', onClose);

    return next.handle();
  }
}
