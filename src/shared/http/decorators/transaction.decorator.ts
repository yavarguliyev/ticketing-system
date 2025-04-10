import { SetMetadata } from '@nestjs/common';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

export const TRANSACTION_ISOLATION_LEVEL = 'TRANSACTION_ISOLATION_LEVEL';
export const TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT';
export const TRANSACTION_STATEMENT_TIMEOUT = 'TRANSACTION_STATEMENT_TIMEOUT';

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
  statementTimeout?: number;
}

export const Transaction = (options?: TransactionOptions) => {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(TRANSACTION_ISOLATION_LEVEL, options?.isolationLevel)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_TIMEOUT, options?.timeout)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_STATEMENT_TIMEOUT, options?.statementTimeout)(target, propertyKey, descriptor);
    return descriptor;
  };
};

export const SerializableTransaction = (options?: Omit<TransactionOptions, 'isolationLevel'>) => {
  return Transaction({ ...options, isolationLevel: 'SERIALIZABLE' });
};

export const RepeatableReadTransaction = (options?: Omit<TransactionOptions, 'isolationLevel'>) => {
  return Transaction({ ...options, isolationLevel: 'REPEATABLE READ' });
};

export const ReadCommittedTransaction = (options?: Omit<TransactionOptions, 'isolationLevel'>) => {
  return Transaction({ ...options, isolationLevel: 'READ COMMITTED' });
};
