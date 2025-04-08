import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class ErrorHandlerMiddleware implements NestMiddleware {
  constructor (@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  use (req: Request, res: Response, next: NextFunction): void {
    const originalSend = res.send;
    const logger = this.logger;
    res.send = function (body: any): Response {
      if (res.statusCode >= 400) {
        logger.error('Error response', {
          statusCode: res.statusCode,
          path: req.path,
          method: req.method,
          body: body,
        });
      }
      return originalSend.call(this, body);
    };
    next();
  }
}
