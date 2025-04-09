import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nestjs-command';
import { DataSource, Migration } from 'typeorm';

@Injectable()
export class MigrationService {
  private readonly logger: Logger = new Logger(MigrationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Command({
    command: 'migration:run',
    describe: 'Run all pending migrations'
  })
  async runMigrations(): Promise<void> {
    const migrations: Migration[] = await this.dataSource.runMigrations();

    if (migrations.length === 0) {
      return;
    }
  }

  @Command({
    command: 'migration:revert',
    describe: 'Revert the last executed migration'
  })
  async revertLastMigration(): Promise<void> {
    await this.dataSource.undoLastMigration();
    const migrations: Migration[] = await this.dataSource.query('SELECT * FROM migrations ORDER BY id DESC LIMIT 1');

    if (migrations.length === 0) {
      this.logger.log('All migrations have been reverted.');
    } else {
      this.logger.log('Successfully reverted the last migration.');
    }
  }

  @Command({
    command: 'migration:revert-all',
    describe: 'Revert all migrations'
  })
  async revertAllMigrations(): Promise<void> {
    const migrations: Migration[] = await this.dataSource.query('SELECT * FROM migrations ORDER BY id DESC');

    if (migrations.length === 0) {
      return;
    }

    for (let i = 0; i < migrations.length; i++) {
      await this.dataSource.undoLastMigration();
    }

    this.logger.log(`Successfully reverted ${migrations.length} migrations.`);
  }

  @Command({
    command: 'migration:status',
    describe: 'Show the status of all migrations'
  })
  async getMigrationStatus(): Promise<void> {
    const migrations: Migration[] = await this.dataSource.query('SELECT * FROM migrations ORDER BY id ASC');

    if (migrations.length === 0) {
      return;
    }

    migrations.forEach((migration: { name: string; timestamp: number }) => {
      const date = new Date(migration.timestamp);
      this.logger.log(`- ${migration.name} (${date.toISOString()})`);
    });
  }
}
