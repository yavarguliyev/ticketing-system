import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { testDbConfig, testDataSource } from './test-database.config';
import { AppModule } from '../src/app.module';
import { Ticket } from '../src/modules/tickets/entities/ticket.entity';
import { CreateTicketDto } from '../src/modules/tickets/dto/create-ticket.dto';

export interface TestContext {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
  entityManager: EntityManager;
  ticketRepository: Repository<Ticket>;
}

export interface TestTicketOptions {
  title?: string;
  description?: string;
  price?: number;
  quantity?: number;
  userId?: string;
}

export async function setupTestApp (): Promise<TestContext> {
  if (!testDataSource.isInitialized) {
    await testDataSource.initialize();
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        ...testDbConfig,
        autoLoadEntities: true
      }),
      AppModule
    ]
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  const dataSource = testDataSource;
  const entityManager = dataSource.manager;
  const ticketRepository = entityManager.getRepository(Ticket);

  return {
    app,
    module: moduleFixture,
    dataSource,
    entityManager,
    ticketRepository
  };
}

export async function teardownTestApp (context: TestContext): Promise<void> {
  await context.app.close();

  if (context.dataSource.isInitialized) {
    await context.dataSource.destroy();
  }
}

export async function resetDatabase (dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE`);
  }
}

export async function createTestTicket (repository: Repository<Ticket>, options: TestTicketOptions = {}): Promise<Ticket> {
  const defaultOptions: TestTicketOptions = {
    title: 'Test Ticket',
    description: 'Test Description',
    price: 100,
    quantity: 10,
    userId: 'test-user-id'
  };

  const ticketData: CreateTicketDto = {
    title: options.title || defaultOptions.title!,
    description: options.description || defaultOptions.description!,
    price: options.price || defaultOptions.price!,
    quantity: options.quantity || defaultOptions.quantity!,
    userId: options.userId || defaultOptions.userId!
  };

  const ticket = repository.create(ticketData);
  return repository.save(ticket);
}

export async function createBatchTestTickets (repository: Repository<Ticket>, count: number, options: TestTicketOptions = {}): Promise<Ticket[]> {
  const tickets: Ticket[] = [];

  for (let i = 0; i < count; i++) {
    const ticket = await createTestTicket(repository, {
      ...options,
      title: options.title ? `${options.title} ${i + 1}` : `Test Ticket ${i + 1}`
    });
    tickets.push(ticket);
  }

  return tickets;
}

export async function delay (ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeWithRetry<T> (operation: () => Promise<T>, maxRetries: number = 3, delayMs: number = 100, backoffFactor: number = 1.5): Promise<T> {
  let lastError: Error | null = null;
  let currentDelay = delayMs;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        await delay(currentDelay);
        currentDelay *= backoffFactor;
      }
    }
  }

  throw lastError || new Error('Operation failed after max retries');
}

export function getRandomInt (min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
