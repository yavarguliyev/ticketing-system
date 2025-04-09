import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { WinstonModule, utilities } from 'nest-winston';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommandModule } from 'nestjs-command';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as winston from 'winston';
import { APP_FILTER } from '@nestjs/core';

import { MigrationService } from './cli/migrations/migration.service';
import { SeedCommand } from './cli/seeding/seed.command';
import { SeedingService } from './cli/seeding/seeding.service';
import { DatabaseBackupCommand } from './database/backup/database-backup.command';
import { DatabaseBackupService } from './database/backup/database-backup.service';
import { DatabaseMetricsService } from './database/services/database-metrics.service';
import { IsolationLevelService } from './database/services/isolation-level.service';
import { TransactionService } from './database/services/transaction.service';
import { OptimisticConcurrencyService } from './database/services/optimistic-concurrency.service';
import { HealthController } from './http/controllers/health.controller';
import { IsolationLevelController } from './http/controllers/isolation-level.controller';
import { ErrorHandlerMiddleware } from './http/middleware/error-handler.middleware';
import { AppThrottlerGuard } from './http/guards/throttler.guard';
import { LoggingInterceptor } from './http/interceptors/logging.interceptor';
import { TransactionInterceptor } from './http/interceptors/transaction.interceptor';
import { DatabaseLockExceptionFilter } from './http/filters/database-lock.filter';
import { OptimisticLockExceptionFilter } from './http/filters/optimistic-lock.filter';
import { Ticket } from '../modules/tickets/entities/ticket.entity';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    TerminusModule,
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
            utilities.format.nestLike('Ticketing System')
          )
        })
      ]
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10
      }
    ]),
    TypeOrmModule.forRootAsync({
      imports: [SharedModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [Ticket],
        synchronize: false,
        logging: false,
        maxQueryExecutionTime: 1000,
        migrations: [__dirname + '/../../migrations/*.js'],
        migrationsRun: true,
        migrationsTableName: 'migrations',
        migrationsTransactionMode: 'each'
      })
    }),
    TypeOrmModule.forFeature([Ticket]),
    CommandModule,
    ScheduleModule.forRoot()
  ],
  controllers: [HealthController, IsolationLevelController],
  providers: [
    ErrorHandlerMiddleware,
    SeedingService,
    SeedCommand,
    AppThrottlerGuard,
    LoggingInterceptor,
    MigrationService,
    DatabaseMetricsService,
    DatabaseBackupService,
    DatabaseBackupCommand,
    TransactionService,
    TransactionInterceptor,
    IsolationLevelService,
    OptimisticConcurrencyService,
    {
      provide: APP_FILTER,
      useClass: DatabaseLockExceptionFilter
    },
    {
      provide: APP_FILTER,
      useClass: OptimisticLockExceptionFilter
    },
    {
      provide: 'winston',
      useFactory: () => {
        return winston.createLogger({
          transports: [
            new winston.transports.Console({
              format: winston.format.combine(winston.format.timestamp(), winston.format.json())
            })
          ]
        });
      }
    }
  ],
  exports: [
    ConfigModule,
    WinstonModule,
    TerminusModule,
    ThrottlerModule,
    SeedingService,
    AppThrottlerGuard,
    LoggingInterceptor,
    MigrationService,
    DatabaseMetricsService,
    DatabaseBackupService,
    TypeOrmModule,
    TransactionService,
    TransactionInterceptor,
    IsolationLevelService,
    OptimisticConcurrencyService
  ]
})
export class SharedModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorHandlerMiddleware).forRoutes('*');
  }
}
