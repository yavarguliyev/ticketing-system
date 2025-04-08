import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { TransactionService } from '../services/transaction.service';
import { DataSource } from 'typeorm';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor (
    private readonly transactionService: TransactionService,
    private readonly dataSource: DataSource
  ) {}

  intercept (context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const handler = context.getHandler();
    const target = context.getClass();
    const isolationLevel = this.transactionService.getIsolationLevel(target, handler.name);
    const timeout = this.transactionService.getTimeout(target, handler.name);

    if (!isolationLevel) {
      return next.handle();
    }

    return from(
      this.transactionService.execute(
        async (entityManager) => {
          const req = context.switchToHttp().getRequest();
          req.entityManager = entityManager;
          
          return next.handle().toPromise();
        },
        isolationLevel,
        timeout
      )
    );
  }
} 