import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface DatabaseMetrics {
  used: number;
  free: number;
  total: number;
  maxConnections: number;
  waitingClients: number;
  usePercentage: number;
}

interface MetricsData {
  metrics: DatabaseMetrics;
  timestamp: string;
}

interface PgStatActivityResult {
  total: string;
  active: string;
  idle: string;
  waiting: string;
}

interface MaxConnectionsResult {
  max_connections: string;
}

@Injectable()
export class DatabaseMetricsService implements OnModuleInit {
  private readonly logger: Logger = new Logger(DatabaseMetricsService.name);

  constructor (@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit (): void {
    void this.reportConnectionMetrics();
  }

  @Interval(60000)
  async reportConnectionMetrics (): Promise<void> {
    try {
      const metrics = await this.getConnectionPoolMetrics();

      if (metrics.metrics.usePercentage > 80) {
        this.logger.warn(`High database connection pool usage: ${metrics.metrics.usePercentage.toFixed(2)}%`, {
          metrics,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Failed to collect connection metrics: ${error.message}`);
      } else {
        this.logger.error(`Failed to collect connection metrics: ${String(error)}`);
      }
    }
  }

  async getConnectionPoolMetrics (): Promise<MetricsData> {
    return await this.fetchConnectionPoolMetrics();
  }

  private async fetchConnectionPoolMetrics (): Promise<MetricsData> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    const result = (await queryRunner.query(
      `
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock') as waiting
      FROM 
        pg_stat_activity
      WHERE 
        datname = $1
    `,
      [this.dataSource.options.database]
    )) as PgStatActivityResult[];

    const maxConnectionsResult = (await queryRunner.query(`
      SELECT setting::integer as max_connections 
      FROM pg_settings 
      WHERE name = 'max_connections'
    `)) as MaxConnectionsResult[];

    await queryRunner.release();

    const metrics: DatabaseMetrics = {
      used: parseInt(result[0].active, 10),
      free: parseInt(result[0].idle, 10),
      total: parseInt(result[0].total, 10),
      maxConnections: parseInt(maxConnectionsResult[0].max_connections, 10),
      waitingClients: parseInt(result[0].waiting, 10),
      usePercentage: (parseInt(result[0].active, 10) / parseInt(maxConnectionsResult[0].max_connections, 10)) * 100
    };

    return {
      metrics,
      timestamp: new Date().toISOString()
    };
  }
}
