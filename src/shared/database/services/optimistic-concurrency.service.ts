import { Injectable, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ConflictException } from '@nestjs/common';

export type RetryOptions = {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
};

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 50,
  maxDelay: 1000,
  backoffFactor: 2
};

@Injectable()
export class OptimisticConcurrencyService {
  private readonly logger = new Logger(OptimisticConcurrencyService.name);

  async executeWithRetry<T> (operation: () => Promise<T>, options: Partial<RetryOptions> = {}, context: string = 'operation'): Promise<T> {
    const retryOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let currentRetry = 0;
    let delay = retryOptions.initialDelay;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        if (this.isOptimisticLockError(error) && currentRetry < retryOptions.maxRetries) {
          currentRetry++;
          this.logger.warn(`Optimistic concurrency conflict detected in ${context}. Retrying (${currentRetry}/${retryOptions.maxRetries})...`);

          await this.delay(delay);

          delay = Math.min(delay * retryOptions.backoffFactor * (1 + 0.2 * Math.random()), retryOptions.maxDelay);
        } else if (this.isOptimisticLockError(error)) {
          throw new ConflictException(`Failed to complete ${context} after ${retryOptions.maxRetries} retries due to concurrent modifications`);
        } else {
          throw error;
        }
      }
    }
  }

  private isOptimisticLockError (error: unknown): boolean {
    if (error instanceof ConflictException) {
      return true;
    }

    if (error instanceof QueryFailedError) {
      const message = error.message.toLowerCase();
      return (
        message.includes('could not serialize access due to concurrent update') ||
        message.includes('version check failed') ||
        message.includes('optimistic lock') ||
        message.includes('row was updated or deleted by another transaction')
      );
    }

    return false;
  }

  private delay (ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
