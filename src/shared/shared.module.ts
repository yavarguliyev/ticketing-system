import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommandModule } from 'nestjs-command';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './controllers/health.controller';
import { ErrorHandlerMiddleware } from './middleware/error-handler.middleware';
import { SeedingService } from './seeding/seeding.service';
import { SeedCommand } from './seeding/seed.command';
import { AppThrottlerGuard } from './guards/throttler.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { MigrationService } from './migrations/migration.service';
import { DatabaseMetricsService } from './database/database-metrics.service';
import { DatabaseBackupService } from './database/database-backup.service';
import { DatabaseBackupCommand } from './database/database-backup.command';
import { Ticket } from '../modules/tickets/entities/ticket.entity';
import { TransactionService } from './services/transaction.service';
import { TransactionInterceptor } from './interceptors/transaction.interceptor';
import { DatabaseQueryLoggerService } from './database/database-query-logger.service';
import { IsolationLevelService } from './services/isolation-level.service';
import { IsolationLevelController } from './controllers/isolation-level.controller';

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
          format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
      ]
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10
      }
    ]),
    TypeOrmModule.forFeature([Ticket]),
    CommandModule,
    ScheduleModule.forRoot(),
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
    DatabaseQueryLoggerService,
    IsolationLevelService,
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
    DatabaseQueryLoggerService,
    IsolationLevelService
  ]
})
export class SharedModule implements NestModule {
  configure (consumer: MiddlewareConsumer): void {
    consumer.apply(ErrorHandlerMiddleware).forRoutes('*');
  }
}
