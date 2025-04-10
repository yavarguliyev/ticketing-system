import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

export const testDbConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.TEST_DATABASE_HOST || 'localhost',
  port: parseInt(process.env.TEST_DATABASE_PORT || '5432', 10),
  username: process.env.TEST_DATABASE_USER || 'postgres',
  password: process.env.TEST_DATABASE_PASSWORD || 'postgres',
  database: process.env.TEST_DATABASE_NAME || 'ticketing_test',
  entities: [join(__dirname, '../src/**/*.entity{.ts,.js}')],
  synchronize: true,
  dropSchema: true,
  logging: process.env.TEST_DATABASE_LOGGING === 'true' ? true : false,
  migrations: [join(__dirname, '../migrations/**/*{.ts,.js}')]
};

export const testDataSource = new DataSource({
  ...testDbConfig
} as DataSourceOptions);
