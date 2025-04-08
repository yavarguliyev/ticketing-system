import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { join } from 'path';
import { Ticket } from '../../modules/tickets/entities/ticket.entity';
import { DatabaseLogger } from './typeorm-logger';

config();

const configService = new ConfigService();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: configService.get<string>('DB_HOST'),
  port: configService.get<number>('DB_PORT'),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_NAME'),
  entities: [Ticket],
  migrations: [join(process.cwd(), 'migrations', '*{.ts,.js}')],
  synchronize: false,
  logging: true,
  logger: new DatabaseLogger({
    logQueries: true,
    logQueryErrors: true,
    logSlowQueries: true
  }),
  maxQueryExecutionTime: 1000,
  migrationsRun: true,
  migrationsTableName: 'migrations',
  migrationsTransactionMode: 'each'
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource; 