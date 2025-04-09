import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { Request } from 'express';

import { TransactionService } from '../../database/services/transaction.service';

interface CustomRequest extends Request {
  entityManager?: unknown;
}

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor (private readonly transactionService: TransactionService) {}

  intercept (context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const target = context.getClass();
    const isolationLevel = this.transactionService.getIsolationLevel(target, handler.name);
    const timeout = this.transactionService.getTimeout(target, handler.name);

    if (!isolationLevel) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<CustomRequest>();

    return from(
      this.transactionService.execute(
        async (entityManager) => {
          req.entityManager = entityManager;

          return (await next.handle().toPromise()) as unknown;
        },
        isolationLevel,
        timeout
      )
    );
  }
}
