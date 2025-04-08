import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';
import { TRANSACTION_ISOLATION_LEVEL, TRANSACTION_TIMEOUT } from '../decorators/transaction.decorator';

export type TransactionCallback<T> = (entityManager: EntityManager) => Promise<T>;

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor (
    private readonly dataSource: DataSource
  ) {}

  async execute<T> (
    callback: TransactionCallback<T>,
    isolationLevel: IsolationLevel = 'READ COMMITTED',
    timeout?: number
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction(isolationLevel);

    if (timeout) {
      setTimeout(() => {
        if (!queryRunner.isReleased) {
          this.logger.warn(`Transaction timed out after ${timeout}ms, rolling back`);
          void queryRunner.rollbackTransaction();
          void queryRunner.release();
        }
      }, timeout);
    }

    try {
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction rolled back due to error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  getIsolationLevel (target: object, propertyKey: string): IsolationLevel | undefined {
    return Reflect.getMetadata(TRANSACTION_ISOLATION_LEVEL, target, propertyKey);
  }

  getTimeout (target: object, propertyKey: string): number | undefined {
    return Reflect.getMetadata(TRANSACTION_TIMEOUT, target, propertyKey);
  }

  async withTransaction<T> (
    callback: TransactionCallback<T>,
    isolationLevel: IsolationLevel = 'READ COMMITTED'
  ): Promise<T> {
    return this.execute(callback, isolationLevel);
  }

  async withSerializableTransaction<T> (callback: TransactionCallback<T>): Promise<T> {
    return this.execute(callback, 'SERIALIZABLE');
  }

  async withRepeatableReadTransaction<T> (callback: TransactionCallback<T>): Promise<T> {
    return this.execute(callback, 'REPEATABLE READ');
  }
} 