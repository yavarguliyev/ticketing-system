import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { faker } from '@faker-js/faker';
import { Repository, DataSource } from 'typeorm';

import { Ticket } from '../../../modules/tickets/entities/ticket.entity';

@Injectable()
export class SeedingService {
  constructor (
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly dataSource: DataSource
  ) {}

  async seed (): Promise<void> {
    if (!this.dataSource.isInitialized) {
      throw new Error('Database connection is not initialized');
    }

    const tickets = Array.from({ length: 20 }, () => {
      const ticket = new Ticket();

      ticket.title = faker.commerce.productName();
      ticket.description = faker.commerce.productDescription();
      ticket.price = parseFloat(faker.commerce.price({ min: 10, max: 500 }));
      ticket.quantity = faker.number.int({ min: 10, max: 1000 });
      ticket.userId = faker.string.uuid();

      return ticket;
    });

    await this.ticketRepository.save(tickets);
  }

  async clear (): Promise<void> {
    await this.ticketRepository.clear();
  }
}
