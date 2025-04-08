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

@Injectable()
export class DatabaseMetricsService implements OnModuleInit {
  private readonly logger: Logger = new Logger(DatabaseMetricsService.name);
  private readonly metricsInterval: number = 60000;

  constructor (@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit (): void {
    this.reportConnectionMetrics();
  }

  @Interval(60000)
  async reportConnectionMetrics (): Promise<void> {
    try {
      const metrics = await this.getConnectionPoolMetrics();
      
      this.logger.log('Database connection pool metrics', {
        metrics,
        timestamp: new Date().toISOString(),
      });
      
      if (metrics.metrics.usePercentage > 80) {
        this.logger.warn(`High database connection pool usage: ${metrics.metrics.usePercentage.toFixed(2)}%`, {
          metrics,
          timestamp: new Date().toISOString(),
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
    const metrics = await this.fetchConnectionPoolMetrics();
    this.logger.log('Database connection pool metrics', { metrics });
    return metrics;
  }

  private async fetchConnectionPoolMetrics (): Promise<MetricsData> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    const result = await queryRunner.query(`
      SELECT 
        count(*) as total,
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock') as waiting
      FROM 
        pg_stat_activity
      WHERE 
        datname = $1
    `, [this.dataSource.options.database]);

    const maxConnectionsResult = await queryRunner.query(`
      SELECT setting::integer as max_connections 
      FROM pg_settings 
      WHERE name = 'max_connections'
    `);

    await queryRunner.release();

    const metrics: DatabaseMetrics = {
      used: result[0].active,
      free: result[0].idle,
      total: result[0].total,
      maxConnections: maxConnectionsResult[0].max_connections,
      waitingClients: result[0].waiting,
      usePercentage: (result[0].active / maxConnectionsResult[0].max_connections) * 100
    };

    return {
      metrics,
      timestamp: new Date().toISOString()
    };
  }
} 