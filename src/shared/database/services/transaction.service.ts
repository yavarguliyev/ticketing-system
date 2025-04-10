import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { TRANSACTION_ISOLATION_LEVEL, TRANSACTION_TIMEOUT } from '../../http/decorators/transaction.decorator';
import { RollbackStrategyService } from './rollback-strategy.service';

export type TransactionCallback<T> = (entityManager: EntityManager) => Promise<T>;

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
  statementTimeout?: number;
  retryOnDeadlock?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export const DEFAULT_TRANSACTION_TIMEOUT = 30000;
export const DEFAULT_STATEMENT_TIMEOUT = 5000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY = 200;

export const ISOLATION_LEVEL_TIMEOUTS: Record<IsolationLevel, number> = {
  'READ UNCOMMITTED': 5000,
  'READ COMMITTED': 10000,
  'REPEATABLE READ': 15000,
  SERIALIZABLE: 20000
};

export type TransactionErrorHandler = (error: Error) => boolean | Promise<boolean>;

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor (
    private readonly dataSource: DataSource,
    private readonly rollbackStrategyService: RollbackStrategyService
  ) {
    this.rollbackStrategyService.registerDefaultStrategies();
  }

  async execute<T> (
    callback: TransactionCallback<T>,
    isolationLevel: IsolationLevel = 'READ COMMITTED',
    timeout?: number,
    statementTimeout?: number,
    options?: Partial<TransactionOptions>
  ): Promise<T> {
    const retryOnDeadlock = options?.retryOnDeadlock ?? true;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryDelay = options?.retryDelay ?? DEFAULT_RETRY_DELAY;

    let retries = 0;

    while (true) {
      try {
        return await this.executeTransaction(callback, isolationLevel, timeout, statementTimeout);
      } catch (error) {
        const isRetryable = await this.rollbackStrategyService.isRetryable(error);

        if (retryOnDeadlock && isRetryable && retries < maxRetries) {
          retries++;
          this.logger.warn(`Retryable error detected, retrying transaction (${retries}/${maxRetries})...`);
          await this.delay(retryDelay * retries);
          continue;
        }
        throw error;
      }
    }
  }

  private async executeTransaction<T> (callback: TransactionCallback<T>, isolationLevel: IsolationLevel = 'READ COMMITTED', timeout?: number, statementTimeout?: number): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(isolationLevel);

    const txTimeout = timeout || ISOLATION_LEVEL_TIMEOUTS[isolationLevel] || DEFAULT_TRANSACTION_TIMEOUT;
    const stmtTimeout = statementTimeout || Math.min(txTimeout / 2, DEFAULT_STATEMENT_TIMEOUT);

    let timeoutHandle: NodeJS.Timeout | undefined;

    await queryRunner.query(`SET statement_timeout = ${stmtTimeout}`);

    this.logger.debug(`Starting transaction with isolation level ${isolationLevel}, ` + `transaction timeout ${txTimeout}ms, statement timeout ${stmtTimeout}ms`);

    if (txTimeout > 0) {
      timeoutHandle = setTimeout(() => {
        if (!queryRunner.isReleased) {
          this.logger.warn(`Transaction (${isolationLevel}) timed out after ${txTimeout}ms, rolling back`);
          void queryRunner.rollbackTransaction();
          void queryRunner.release();
        }
      }, txTimeout);
    }

    try {
      const result: T = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      this.logger.debug(`Successfully committed transaction with isolation level ${isolationLevel}`);
      return result;
    } catch (error) {
      await this.rollbackStrategyService.handleRollback(error, async () => {
        await queryRunner.rollbackTransaction();
        this.logger.debug(`Successfully rolled back transaction with isolation level ${isolationLevel}`);
      });
      throw error;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  private delay (ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getIsolationLevel (target: object, propertyKey: string): IsolationLevel | undefined {
    return Reflect.getMetadata(TRANSACTION_ISOLATION_LEVEL, target, propertyKey) as IsolationLevel | undefined;
  }

  getTimeout (target: object, propertyKey: string): number | undefined {
    return Reflect.getMetadata(TRANSACTION_TIMEOUT, target, propertyKey) as number | undefined;
  }

  async withTransaction<T> (callback: TransactionCallback<T>, isolationLevel: IsolationLevel = 'READ COMMITTED', options?: Partial<TransactionOptions>): Promise<T> {
    return this.execute(callback, isolationLevel, options?.timeout, options?.statementTimeout, options);
  }

  async withSerializableTransaction<T> (callback: TransactionCallback<T>, options?: Partial<Omit<TransactionOptions, 'isolationLevel'>>): Promise<T> {
    return this.withTransaction(callback, 'SERIALIZABLE', options);
  }

  async withRepeatableReadTransaction<T> (callback: TransactionCallback<T>, options?: Partial<Omit<TransactionOptions, 'isolationLevel'>>): Promise<T> {
    return this.withTransaction(callback, 'REPEATABLE READ', options);
  }

  async withReadCommittedTransaction<T> (callback: TransactionCallback<T>, options?: Partial<Omit<TransactionOptions, 'isolationLevel'>>): Promise<T> {
    return this.withTransaction(callback, 'READ COMMITTED', options);
  }
}
