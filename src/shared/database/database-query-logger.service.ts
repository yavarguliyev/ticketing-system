import { Injectable, Logger } from '@nestjs/common';
import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';

@Injectable()
export class DatabaseQueryLoggerService implements TypeOrmLogger {
  private readonly logger = new Logger('Database');

  logQuery (query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    this.logger.debug(`Query: ${query}`, { parameters });
  }

  logQueryError (error: string, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    this.logger.error(`Query Error: ${error}`, { query, parameters });
  }

  logQuerySlow (time: number, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
    this.logger.warn(`Slow Query (${time}ms): ${query}`, { parameters });
  }

  logSchemaBuild (message: string, queryRunner?: QueryRunner): void {
    this.logger.debug(`Schema Build: ${message}`);
  }

  logMigration (message: string, queryRunner?: QueryRunner): void {
    this.logger.debug(`Migration: ${message}`);
  }

  log (level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner): void {
    switch (level) {
      case 'log':
        this.logger.debug(message);
        break;
      case 'info':
        this.logger.log(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
    }
  }
} 