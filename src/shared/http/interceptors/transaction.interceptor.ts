import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { Request } from 'express';

import { TransactionService } from '../../database/services/transaction.service';
import {
  TRANSACTION_ISOLATION_LEVEL,
  TRANSACTION_STATEMENT_TIMEOUT,
  TRANSACTION_TIMEOUT
} from '../decorators/transaction.decorator';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

interface CustomRequest extends Request {
  entityManager?: unknown;
}

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(private readonly transactionService: TransactionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const target = context.getClass();

    const isolationLevel = Reflect.getMetadata(TRANSACTION_ISOLATION_LEVEL, target, handler.name) as IsolationLevel;
    const timeout = Reflect.getMetadata(TRANSACTION_TIMEOUT, target, handler.name) as number;
    const statementTimeout = Reflect.getMetadata(TRANSACTION_STATEMENT_TIMEOUT, target, handler.name) as number;

    if (!isolationLevel) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<CustomRequest>();

    return from(
      this.transactionService.execute(
        async (entityManager) => {
          req.entityManager = entityManager;

          return (await lastValueFrom(next.handle())) as unknown;
        },
        isolationLevel,
        timeout,
        statementTimeout
      )
    );
  }
}
