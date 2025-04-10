import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { Request } from 'express';

import { TransactionService } from '../../database/services/transaction.service';
import {
  TRANSACTION_ISOLATION_LEVEL,
  TRANSACTION_STATEMENT_TIMEOUT,
  TRANSACTION_TIMEOUT,
  TRANSACTION_RETRY_ON_DEADLOCK,
  TRANSACTION_MAX_RETRIES,
  TRANSACTION_RETRY_DELAY
} from '../decorators/transaction.decorator';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

interface CustomRequest extends Request {
  entityManager?: unknown;
}

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransactionInterceptor.name);

  constructor(private readonly transactionService: TransactionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const target = context.getClass();

    const isolationLevel = Reflect.getMetadata(TRANSACTION_ISOLATION_LEVEL, target, handler.name) as IsolationLevel;

    if (!isolationLevel) {
      return next.handle();
    }

    const timeout = Reflect.getMetadata(TRANSACTION_TIMEOUT, target, handler.name) as number;
    const statementTimeout = Reflect.getMetadata(TRANSACTION_STATEMENT_TIMEOUT, target, handler.name) as number;
    const retryOnDeadlock = Reflect.getMetadata(TRANSACTION_RETRY_ON_DEADLOCK, target, handler.name) as boolean;
    const maxRetries = Reflect.getMetadata(TRANSACTION_MAX_RETRIES, target, handler.name) as number;
    const retryDelay = Reflect.getMetadata(TRANSACTION_RETRY_DELAY, target, handler.name) as number;

    const req = context.switchToHttp().getRequest<CustomRequest>();
    const handlerName = handler.name;
    const controllerName = target.name;

    this.logger.debug(`Starting transaction for ${controllerName}.${handlerName} with isolation level ${isolationLevel}`);

    return from(
      this.transactionService.execute(
        async (entityManager) => {
          req.entityManager = entityManager;

          this.logger.debug(`Executing ${controllerName}.${handlerName} in transaction context`);
          const result = (await lastValueFrom(next.handle())) as unknown;

          this.logger.debug(`Completed ${controllerName}.${handlerName} successfully, committing transaction`);
          return result;
        },
        isolationLevel,
        timeout,
        statementTimeout,
        {
          retryOnDeadlock,
          maxRetries,
          retryDelay
        }
      )
    );
  }
}
