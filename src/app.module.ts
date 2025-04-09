import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { join } from 'path';

import { TicketsModule } from './modules/tickets/tickets.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    SharedModule,
    ThrottlerModule.forRootAsync({
      imports: [SharedModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => [
        {
          ttl: configService.get<number>('THROTTLE_TTL') || 60,
          limit: configService.get<number>('THROTTLE_LIMIT') || 10
        }
      ]
    }),
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
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: false,
        maxQueryExecutionTime: 1000,
        migrations: [join(process.cwd(), 'migrations', '*.js')],
        migrationsRun: true,
        migrationsTableName: 'migrations',
        migrationsTransactionMode: 'each'
      })
    }),
    TicketsModule
  ]
})
export class AppModule {}
