import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { TRANSACTION_ISOLATION_LEVEL, TRANSACTION_TIMEOUT } from '../../http/decorators/transaction.decorator';

export type TransactionCallback<T> = (entityManager: EntityManager) => Promise<T>;

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
  statementTimeout?: number;
}

export const DEFAULT_TRANSACTION_TIMEOUT = 30000;
export const DEFAULT_STATEMENT_TIMEOUT = 5000;

export const ISOLATION_LEVEL_TIMEOUTS: Record<IsolationLevel, number> = {
  'READ UNCOMMITTED': 5000,
  'READ COMMITTED': 10000,
  'REPEATABLE READ': 15000,
  SERIALIZABLE: 20000
};

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor (private readonly dataSource: DataSource) {}

  async execute<T> (
    callback: TransactionCallback<T>,
    isolationLevel: IsolationLevel = 'READ COMMITTED',
    timeout?: number,
    statementTimeout?: number
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(isolationLevel);

    const txTimeout = timeout || ISOLATION_LEVEL_TIMEOUTS[isolationLevel] || DEFAULT_TRANSACTION_TIMEOUT;
    const stmtTimeout = statementTimeout || Math.min(txTimeout / 2, DEFAULT_STATEMENT_TIMEOUT);

    let timeoutHandle: NodeJS.Timeout | undefined;

    await queryRunner.query(`SET statement_timeout = ${stmtTimeout}`);

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
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof QueryFailedError) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('deadlock detected')) {
          this.logger.warn('Deadlock detected during transaction, rolled back');
        } else if (errorMessage.includes('could not serialize access') || errorMessage.includes('concurrent update')) {
          this.logger.warn(`Serialization failure in ${isolationLevel} transaction, rolled back`);
        } else if (errorMessage.includes('statement timeout')) {
          this.logger.warn(`Statement timeout (${stmtTimeout}ms) exceeded in ${isolationLevel} transaction`);
        } else {
          this.logger.error(`Transaction (${isolationLevel}) error: ${error.message}`);
        }
      } else {
        this.logger.error(
          `Transaction (${isolationLevel}) error: ${error instanceof Error ? error.message : String(error)}`
        );
      }

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

  getIsolationLevel (target: object, propertyKey: string): IsolationLevel | undefined {
    return Reflect.getMetadata(TRANSACTION_ISOLATION_LEVEL, target, propertyKey) as IsolationLevel | undefined;
  }

  getTimeout (target: object, propertyKey: string): number | undefined {
    return Reflect.getMetadata(TRANSACTION_TIMEOUT, target, propertyKey) as number | undefined;
  }

  async withTransaction<T> (
    callback: TransactionCallback<T>,
    isolationLevel: IsolationLevel = 'READ COMMITTED',
    options?: Partial<TransactionOptions>
  ): Promise<T> {
    return this.execute(callback, isolationLevel, options?.timeout, options?.statementTimeout);
  }

  async withSerializableTransaction<T> (
    callback: TransactionCallback<T>,
    options?: Partial<Omit<TransactionOptions, 'isolationLevel'>>
  ): Promise<T> {
    return this.execute(callback, 'SERIALIZABLE', options?.timeout, options?.statementTimeout);
  }

  async withRepeatableReadTransaction<T> (
    callback: TransactionCallback<T>,
    options?: Partial<Omit<TransactionOptions, 'isolationLevel'>>
  ): Promise<T> {
    return this.execute(callback, 'REPEATABLE READ', options?.timeout, options?.statementTimeout);
  }

  async withReadCommittedTransaction<T> (
    callback: TransactionCallback<T>,
    options?: Partial<Omit<TransactionOptions, 'isolationLevel'>>
  ): Promise<T> {
    return this.execute(callback, 'READ COMMITTED', options?.timeout, options?.statementTimeout);
  }
}
