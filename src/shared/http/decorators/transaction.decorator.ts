import { SetMetadata } from '@nestjs/common';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

export const TRANSACTION_ISOLATION_LEVEL = 'TRANSACTION_ISOLATION_LEVEL';
export const TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT';
export const TRANSACTION_STATEMENT_TIMEOUT = 'TRANSACTION_STATEMENT_TIMEOUT';
export const TRANSACTION_RETRY_ON_DEADLOCK = 'TRANSACTION_RETRY_ON_DEADLOCK';
export const TRANSACTION_MAX_RETRIES = 'TRANSACTION_MAX_RETRIES';
export const TRANSACTION_RETRY_DELAY = 'TRANSACTION_RETRY_DELAY';

export interface TransactionDecoratorOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
  statementTimeout?: number;
  retryOnDeadlock?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Decorator that wraps the method execution in a database transaction with configurable options.
 * Use together with TransactionInterceptor for controller methods.
 *
 * @param options Configuration options for the transaction
 * @returns MethodDecorator
 *
 * @example
 * // Basic usage with default settings (READ COMMITTED isolation)
 * @Transaction()
 * async createUser(createUserDto: CreateUserDto): Promise<User> {
 *   // Method will run in a transaction
 * }
 *
 * @example
 * // With custom isolation level and timeout
 * @Transaction({
 *   isolationLevel: 'SERIALIZABLE',
 *   timeout: 10000,
 *   retryOnDeadlock: true,
 *   maxRetries: 3
 * })
 * async transferFunds(transferDto: TransferDto): Promise<void> {
 *   // Method will run in a SERIALIZABLE transaction with 10s timeout
 *   // Will retry up to 3 times on deadlock
 * }
 */
export const Transaction = (options?: TransactionDecoratorOptions) => {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(TRANSACTION_ISOLATION_LEVEL, options?.isolationLevel)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_TIMEOUT, options?.timeout)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_STATEMENT_TIMEOUT, options?.statementTimeout)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_RETRY_ON_DEADLOCK, options?.retryOnDeadlock)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_MAX_RETRIES, options?.maxRetries)(target, propertyKey, descriptor);
    SetMetadata(TRANSACTION_RETRY_DELAY, options?.retryDelay)(target, propertyKey, descriptor);
    return descriptor;
  };
};

/**
 * Decorator that wraps the method execution in a SERIALIZABLE transaction.
 * This is the highest isolation level, preventing dirty reads, non-repeatable reads, and phantom reads.
 *
 * @param options Configuration options for the transaction (except isolation level)
 * @returns MethodDecorator
 *
 * @example
 * @SerializableTransaction({ timeout: 20000 })
 * async processBankingOperation(operationDto: OperationDto): Promise<void> {
 *   // Method will run in a SERIALIZABLE transaction with 20s timeout
 * }
 */
export const SerializableTransaction = (options?: Omit<TransactionDecoratorOptions, 'isolationLevel'>) => {
  return Transaction({ ...options, isolationLevel: 'SERIALIZABLE' });
};

/**
 * Decorator that wraps the method execution in a REPEATABLE READ transaction.
 * This isolation level prevents dirty reads and non-repeatable reads, but allows phantom reads.
 *
 * @param options Configuration options for the transaction (except isolation level)
 * @returns MethodDecorator
 *
 * @example
 * @RepeatableReadTransaction()
 * async getAllProducts(): Promise<Product[]> {
 *   // Method will run in a REPEATABLE READ transaction
 * }
 */
export const RepeatableReadTransaction = (options?: Omit<TransactionDecoratorOptions, 'isolationLevel'>) => {
  return Transaction({ ...options, isolationLevel: 'REPEATABLE READ' });
};

/**
 * Decorator that wraps the method execution in a READ COMMITTED transaction.
 * This isolation level prevents dirty reads, but allows non-repeatable reads and phantom reads.
 * This is typically the default isolation level in most databases.
 *
 * @param options Configuration options for the transaction (except isolation level)
 * @returns MethodDecorator
 *
 * @example
 * @ReadCommittedTransaction()
 * async updateUserProfile(userId: string, profileDto: ProfileDto): Promise<User> {
 *   // Method will run in a READ COMMITTED transaction
 * }
 */
export const ReadCommittedTransaction = (options?: Omit<TransactionDecoratorOptions, 'isolationLevel'>) => {
  return Transaction({ ...options, isolationLevel: 'READ COMMITTED' });
};
