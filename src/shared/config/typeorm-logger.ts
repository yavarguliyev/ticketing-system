import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class DatabaseLogger implements TypeOrmLogger {
  private readonly logger: Logger = new Logger('TypeORM');

  constructor (private readonly options: {
    logQueries?: boolean;
    logQueryErrors?: boolean;
    logSlowQueries?: boolean;
  } = {
    logQueries: true,
    logQueryErrors: true,
    logSlowQueries: true
  }) {}

  logQuery (query: string, parameters?: unknown[], queryRunner?: QueryRunner): void {
    if (this.options.logQueries) {
      const sql = this.buildSqlString(query, parameters);
      this.logger.log(`Query: ${sql}`);
    }
  }

  logQueryError (error: string, query: string, parameters?: unknown[], queryRunner?: QueryRunner): void {
    if (this.options.logQueryErrors) {
      const sql = this.buildSqlString(query, parameters);
      this.logger.error(`Query error: ${sql}`);
      this.logger.error(`Error: ${error}`);
    }
  }

  logQuerySlow (time: number, query: string, parameters?: unknown[], queryRunner?: QueryRunner): void {
    if (this.options.logSlowQueries) {
      const sql = this.buildSqlString(query, parameters);
      this.logger.warn(`Slow query (${time}ms): ${sql}`);
    }
  }

  logMigration (message: string): void {
    this.logger.log(`Migration: ${message}`);
  }

  logSchemaBuild (message: string): void {
    this.logger.log(`Schema build: ${message}`);
  }

  log (level: 'log' | 'info' | 'warn', message: string): void {
    switch (level) {
      case 'log':
      case 'info':
        this.logger.log(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
    }
  }

  private buildSqlString (query: string, parameters?: unknown[]): string {
    if (!parameters || !parameters.length) {
      return query;
    }

    return `${query} -- Parameters: ${JSON.stringify(parameters)}`;
  }
} 