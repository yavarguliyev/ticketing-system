import { Injectable, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

export type RollbackAction = () => Promise<void>;
export type OnRollbackCallback = (error: unknown, rollbackError?: unknown) => Promise<void> | void;

export interface RollbackStrategy {
  shouldRollback: (error: unknown) => boolean | Promise<boolean>;
  onRollback?: OnRollbackCallback;
  retryable?: boolean;
}

@Injectable()
export class RollbackStrategyService {
  private readonly logger = new Logger(RollbackStrategyService.name);
  private readonly strategies: RollbackStrategy[] = [];

  registerStrategy (strategy: RollbackStrategy): RollbackStrategyService {
    this.strategies.push(strategy);
    return this;
  }

  registerDefaultStrategies (): RollbackStrategyService {
    this.registerStrategy({
      shouldRollback: (error) => this.isDeadlockError(error),
      onRollback: () => this.logger.warn('Deadlock detected, transaction rolled back'),
      retryable: true
    });

    this.registerStrategy({
      shouldRollback: (error) => this.isSerializationError(error),
      onRollback: () => this.logger.warn('Serialization failure detected, transaction rolled back'),
      retryable: true
    });

    this.registerStrategy({
      shouldRollback: (error) => this.isLockTimeoutError(error),
      onRollback: () => this.logger.warn('Lock timeout detected, transaction rolled back'),
      retryable: false
    });

    this.registerStrategy({
      shouldRollback: (error) => this.isStatementTimeoutError(error),
      onRollback: () => this.logger.warn('Statement timeout detected, transaction rolled back'),
      retryable: false
    });

    return this;
  }

  async isRetryable (error: unknown): Promise<boolean> {
    for (const strategy of this.strategies) {
      try {
        const shouldRollback = await strategy.shouldRollback(error);
        if (shouldRollback && strategy.retryable) {
          return true;
        }
      } catch (strategyError) {
        this.logger.error(`Error in rollback strategy: ${strategyError instanceof Error ? strategyError.message : String(strategyError)}`);
      }
    }
    return false;
  }

  async handleRollback (error: unknown, rollbackAction: RollbackAction): Promise<boolean> {
    let strategyMatched = false;
    let rollbackError: unknown;

    try {
      await rollbackAction();
    } catch (err) {
      rollbackError = err;
      this.logger.error(`Failed to rollback transaction: ${err instanceof Error ? err.message : String(err)}`);
    }

    for (const strategy of this.strategies) {
      try {
        const shouldRollback = await strategy.shouldRollback(error);
        if (shouldRollback) {
          strategyMatched = true;
          if (strategy.onRollback) {
            await strategy.onRollback(error, rollbackError);
          }
        }
      } catch (strategyError) {
        this.logger.error(`Error in rollback strategy: ${strategyError instanceof Error ? strategyError.message : String(strategyError)}`);
      }
    }

    if (!strategyMatched) {
      this.logger.error(`Transaction rolled back due to error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return strategyMatched;
  }

  private isDeadlockError (error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const errorMessage = error.message.toLowerCase();
      return errorMessage.includes('deadlock detected');
    }
    return false;
  }

  private isSerializationError (error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const errorMessage = error.message.toLowerCase();
      return errorMessage.includes('could not serialize access') || errorMessage.includes('concurrent update') || errorMessage.includes('serialization failure');
    }
    return false;
  }

  private isStatementTimeoutError (error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const errorMessage = error.message.toLowerCase();
      return errorMessage.includes('statement timeout');
    }
    return false;
  }

  private isLockTimeoutError (error: unknown): boolean {
    if (error instanceof QueryFailedError) {
      const errorMessage = error.message.toLowerCase();
      return errorMessage.includes('lock timeout') || errorMessage.includes('could not obtain lock') || errorMessage.includes('lock not available');
    }
    return false;
  }
}
