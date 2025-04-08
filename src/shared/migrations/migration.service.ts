import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Command } from 'nestjs-command';

@Injectable()
export class MigrationService {
  private readonly logger: Logger = new Logger(MigrationService.name);

  constructor (@InjectDataSource() private readonly dataSource: DataSource) {}

  @Command({
    command: 'migration:run',
    describe: 'Run all pending migrations',
  })
  async runMigrations (): Promise<void> {
    this.logger.log('Running pending migrations...');
    
    const migrations = await this.dataSource.runMigrations();
    
    if (migrations.length === 0) {
      this.logger.log('No pending migrations to run.');
      return;
    }
    
    this.logger.log(`Successfully ran ${migrations.length} migrations:`);
    migrations.forEach(migration => {
      this.logger.log(`- ${migration.name}`);
    });
  }

  @Command({
    command: 'migration:revert',
    describe: 'Revert the last executed migration',
  })
  async revertLastMigration (): Promise<void> {
    this.logger.log('Reverting the last migration...');
    
    await this.dataSource.undoLastMigration();
    
    const migrations = await this.dataSource.query('SELECT * FROM migrations ORDER BY id DESC LIMIT 1');
    if (migrations.length === 0) {
      this.logger.log('All migrations have been reverted.');
    } else {
      this.logger.log('Successfully reverted the last migration.');
    }
  }

  @Command({
    command: 'migration:revert-all',
    describe: 'Revert all migrations',
  })
  async revertAllMigrations (): Promise<void> {
    this.logger.log('Reverting all migrations...');
    
    const migrations = await this.dataSource.query('SELECT * FROM migrations ORDER BY id DESC');
    
    if (migrations.length === 0) {
      this.logger.log('No migrations to revert.');
      return;
    }
    
    for (let i = 0; i < migrations.length; i++) {
      await this.dataSource.undoLastMigration();
      this.logger.log(`Reverted migration: ${migrations[i].name}`);
    }
    
    this.logger.log(`Successfully reverted ${migrations.length} migrations.`);
  }

  @Command({
    command: 'migration:status',
    describe: 'Show the status of all migrations',
  })
  async getMigrationStatus (): Promise<void> {
    this.logger.log('Getting migration status...');
    
    const migrations = await this.dataSource.query('SELECT * FROM migrations ORDER BY id ASC');
    
    if (migrations.length === 0) {
      this.logger.log('No migrations have been run.');
      return;
    }
    
    this.logger.log(`${migrations.length} migrations have been run:`);
    migrations.forEach((migration: { name: string, timestamp: number }) => {
      const date = new Date(migration.timestamp);
      this.logger.log(`- ${migration.name} (${date.toISOString()})`);
    });
  }
} 