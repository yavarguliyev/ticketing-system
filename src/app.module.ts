import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from './shared/shared.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ConfigService } from '@nestjs/config';
import { DatabaseQueryLoggerService } from './shared/database/database-query-logger.service';
import { join } from 'path';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';

@Module({
  imports: [
    SharedModule,
    ThrottlerModule.forRootAsync({
      imports: [SharedModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => ([{
        ttl: configService.get<number>('THROTTLE_TTL') || 60,
        limit: configService.get<number>('THROTTLE_LIMIT') || 10,
      }]),
    }),
    TypeOrmModule.forRootAsync({
      imports: [SharedModule],
      inject: [ConfigService, DatabaseQueryLoggerService],
      useFactory: (configService: ConfigService, logger: DatabaseQueryLoggerService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: true,
        logger: logger,
        maxQueryExecutionTime: 1000,
        migrations: [join(process.cwd(), 'migrations', '*.js')],
        migrationsRun: true,
        migrationsTableName: 'migrations',
        migrationsTransactionMode: 'each'
      }),
    }),
    TicketsModule,
  ]
})
export class AppModule {}
