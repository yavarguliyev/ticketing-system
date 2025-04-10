import { Repository } from 'typeorm';
import { Ticket } from '../src/modules/tickets/entities/ticket.entity';
import { CreateTicketDto } from '../src/modules/tickets/dto/create-ticket.dto';
import { createTestTicket, TestTicketOptions } from './test-utils';

export interface TicketFixture {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  userId: string;
  version: number;
}

export class FixtureBuilder {
  private ticketRepository: Repository<Ticket>;

  constructor(ticketRepository: Repository<Ticket>) {
    this.ticketRepository = ticketRepository;
  }

  async createTicket(options: TestTicketOptions = {}): Promise<Ticket> {
    return createTestTicket(this.ticketRepository, options);
  }

  async createTickets(count: number, baseOptions: TestTicketOptions = {}): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (let i = 0; i < count; i++) {
      const ticketData: CreateTicketDto = {
        title: baseOptions.title || `Test Ticket ${i + 1}`,
        description: baseOptions.description || `Test Description ${i + 1}`,
        price: baseOptions.price || 100 + i * 10,
        quantity: baseOptions.quantity || 10 + i,
        userId: baseOptions.userId || `user-${i + 1}`
      };

      const ticket = this.ticketRepository.create(ticketData);
      const savedTicket = await this.ticketRepository.save(ticket);
      tickets.push(savedTicket);
    }

    return tickets;
  }

  async createConcurrencyTestFixture(): Promise<Ticket> {
    return this.createTicket({
      title: 'Concurrency Test Ticket',
      description: 'Ticket for testing concurrency mechanisms',
      price: 100,
      quantity: 50,
      userId: 'concurrency-test-user'
    });
  }

  async createPricedTickets(prices: number[]): Promise<Ticket[]> {
    const tickets: Ticket[] = [];

    for (let i = 0; i < prices.length; i++) {
      const ticket = await this.createTicket({
        title: `Price Test Ticket ${i + 1}`,
        description: `Test ticket with price ${prices[i]}`,
        price: prices[i],
        quantity: 10,
        userId: 'price-test-user'
      });

      tickets.push(ticket);
    }

    return tickets;
  }

  async createLowQuantityTicket(): Promise<Ticket> {
    return this.createTicket({
      title: 'Low Quantity Ticket',
      description: 'Ticket with very limited availability',
      price: 200,
      quantity: 1,
      userId: 'inventory-test-user'
    });
  }

  async createHighQuantityTicket(): Promise<Ticket> {
    return this.createTicket({
      title: 'High Quantity Ticket',
      description: 'Ticket with high availability',
      price: 50,
      quantity: 1000,
      userId: 'inventory-test-user'
    });
  }

  async createIsolationTestFixture(): Promise<Ticket> {
    return this.createTicket({
      title: 'Isolation Test Ticket',
      description: 'Ticket for testing transaction isolation levels',
      price: 150,
      quantity: 100,
      userId: 'isolation-test-user'
    });
  }

  async createOptimisticLockingTestFixture(): Promise<Ticket> {
    return this.createTicket({
      title: 'Version Test Ticket',
      description: 'Ticket for testing optimistic locking with version tracking',
      price: 75,
      quantity: 25,
      userId: 'version-test-user'
    });
  }

  async createPessimisticLockingTestFixture(): Promise<Ticket> {
    return this.createTicket({
      title: 'Lock Test Ticket',
      description: 'Ticket for testing pessimistic locking',
      price: 125,
      quantity: 30,
      userId: 'lock-test-user'
    });
  }

  async createFixtureSet(): Promise<{
    defaultTicket: Ticket;
    concurrencyTicket: Ticket;
    lowQuantityTicket: Ticket;
    highQuantityTicket: Ticket;
    isolationTicket: Ticket;
    versionTicket: Ticket;
    lockTicket: Ticket;
    priceTickets: Ticket[];
  }> {
    const defaultTicket = await this.createTicket();
    const concurrencyTicket = await this.createConcurrencyTestFixture();
    const lowQuantityTicket = await this.createLowQuantityTicket();
    const highQuantityTicket = await this.createHighQuantityTicket();
    const isolationTicket = await this.createIsolationTestFixture();
    const versionTicket = await this.createOptimisticLockingTestFixture();
    const lockTicket = await this.createPessimisticLockingTestFixture();
    const priceTickets = await this.createPricedTickets([50, 100, 150, 200, 250]);

    return {
      defaultTicket,
      concurrencyTicket,
      lowQuantityTicket,
      highQuantityTicket,
      isolationTicket,
      versionTicket,
      lockTicket,
      priceTickets
    };
  }
}
