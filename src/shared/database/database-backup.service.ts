import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { Logger } from '@nestjs/common';

const execAsync = promisify(exec);

@Injectable()
export class DatabaseBackupService {
  private readonly logger: Logger = new Logger(DatabaseBackupService.name);

  constructor (private readonly configService: ConfigService) {}

  async createBackup (): Promise<string> {
    const backupDir = this.configService.get<string>('DB_BACKUP_DIR') || 'backups';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = join(process.cwd(), backupDir, `backup-${timestamp}.sql`);

    const command = this.buildBackupCommand(backupFile);
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      this.logger.error(`Backup error: ${stderr}`);
      throw new Error(`Backup failed: ${stderr}`);
    }

    this.logger.log(`Backup created successfully: ${backupFile}`);
    return backupFile;
  }

  async restoreBackup (backupFile: string): Promise<void> {
    const command = this.buildRestoreCommand(backupFile);
    const { stdout, stderr } = await execAsync(command);

    if (stderr) {
      this.logger.error(`Restore error: ${stderr}`);
      throw new Error(`Restore failed: ${stderr}`);
    }

    this.logger.log(`Backup restored successfully from: ${backupFile}`);
  }

  private buildBackupCommand (backupFile: string): string {
    const host = this.configService.get<string>('DB_HOST');
    const port = this.configService.get<number>('DB_PORT');
    const username = this.configService.get<string>('DB_USERNAME');
    const database = this.configService.get<string>('DB_NAME');

    return `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F c -f ${backupFile}`;
  }

  private buildRestoreCommand (backupFile: string): string {
    const host = this.configService.get<string>('DB_HOST');
    const port = this.configService.get<number>('DB_PORT');
    const username = this.configService.get<string>('DB_USERNAME');
    const database = this.configService.get<string>('DB_NAME');

    return `pg_restore -h ${host} -p ${port} -U ${username} -d ${database} ${backupFile}`;
  }
} 