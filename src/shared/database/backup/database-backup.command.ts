import { Injectable } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { DatabaseBackupService } from './database-backup.service';

@Injectable()
export class DatabaseBackupCommand {
  constructor(private readonly backupService: DatabaseBackupService) {}

  @Command({
    command: 'database:backup',
    describe: 'Perform a manual database backup'
  })
  async backup(): Promise<void> {
    const backupPath = await this.backupService.createBackup();
    console.log(`Backup completed successfully to: ${backupPath}`);
  }
}
