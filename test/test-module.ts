import { DynamicModule, Type } from '@nestjs/common';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { testDbConfig } from './test-database.config';
import { TicketsModule } from '../src/modules/tickets/tickets.module';
import { SharedModule } from '../src/shared/shared.module';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Ticket } from '../src/modules/tickets/entities/ticket.entity';
import { TicketsService } from '../src/modules/tickets/services/tickets.service';
import { TransactionService } from '../src/shared/database/services/transaction.service';
import { OptimisticConcurrencyService } from '../src/shared/database/services/optimistic-concurrency.service';

export interface TestModuleOptions {
  imports?: Array<Type<any> | DynamicModule>;
  controllers?: Type<any>[];
  providers?: Type<any>[];
  mocks?: Record<string, any>;
}

export interface TestModuleContext {
  module: TestingModule;
  dataSource: DataSource;
  entityManager: EntityManager;
  ticketRepository: Repository<Ticket>;
  ticketsService: TicketsService;
  transactionService: TransactionService;
  optimisticConcurrencyService: OptimisticConcurrencyService;
}

export async function createTestModule(options: TestModuleOptions = {}): Promise<TestModuleContext> {
  const defaultImports = [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.test'
    }),
    TypeOrmModule.forRoot({
      ...testDbConfig,
      autoLoadEntities: true
    }),
    SharedModule,
    TicketsModule
  ];

  let moduleBuilder: TestingModuleBuilder = Test.createTestingModule({
    imports: [...defaultImports, ...(options.imports || [])],
    controllers: options.controllers || [],
    providers: options.providers || []
  });

  if (options.mocks) {
    for (const [token, mockValue] of Object.entries(options.mocks)) {
      moduleBuilder = moduleBuilder.overrideProvider(token).useValue(mockValue);
    }
  }

  const module = await moduleBuilder.compile();

  const dataSource = module.get<DataSource>(DataSource);
  const entityManager = dataSource.manager;
  const ticketRepository = entityManager.getRepository(Ticket);
  const ticketsService = module.get<TicketsService>(TicketsService);
  const transactionService = module.get<TransactionService>(TransactionService);
  const optimisticConcurrencyService = module.get<OptimisticConcurrencyService>(OptimisticConcurrencyService);

  return {
    module,
    dataSource,
    entityManager,
    ticketRepository,
    ticketsService,
    transactionService,
    optimisticConcurrencyService
  };
}

export async function createTestingAppFromModule(testModule: TestingModule) {
  const app = testModule.createNestApplication();
  await app.init();
  return app;
}

export async function closeTestModule(context: TestModuleContext) {
  await context.module.close();

  if (context.dataSource.isInitialized) {
    await context.dataSource.destroy();
  }
}
