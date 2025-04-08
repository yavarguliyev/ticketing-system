import { SetMetadata } from '@nestjs/common';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

export const TRANSACTION_ISOLATION_LEVEL = 'TRANSACTION_ISOLATION_LEVEL';
export const TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT';

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
}

export const Transaction = (options?: TransactionOptions) => {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(TRANSACTION_ISOLATION_LEVEL, options?.isolationLevel)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_TIMEOUT, options?.timeout)(target, propertyKey, descriptor);
    return descriptor;
  };
}; 