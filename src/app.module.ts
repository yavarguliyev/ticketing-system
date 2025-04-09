import { Module } from '@nestjs/common';
import { TicketsModule } from './modules/tickets/tickets.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [SharedModule, TicketsModule]
})
export class AppModule {}
