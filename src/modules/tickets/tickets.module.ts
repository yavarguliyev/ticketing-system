import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Ticket } from './entities/ticket.entity';
import { TicketsService } from './services/tickets.service';
import { TicketsController } from './controllers/tickets.controller';
import { TransactionInterceptor } from '../../shared/interceptors/transaction.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransactionInterceptor,
    },
  ],
  exports: [TicketsService]
})
export class TicketsModule {}
