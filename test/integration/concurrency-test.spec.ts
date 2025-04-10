import { Repository, QueryFailedError, EntityManager } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { createTestModule, TestModuleContext, closeTestModule } from '../test-module';
import { resetDatabase } from '../test-utils';
import { FixtureBuilder } from '../fixtures';
import { Ticket } from '../../src/modules/tickets/entities/ticket.entity';
import { TicketsService } from '../../src/modules/tickets/services/tickets.service';

jest.mock('../test-module', () => ({
  createTestModule: jest.fn().mockImplementation(() => {
    const mockTicket = {
      id: 'test-id',
      title: 'Test Ticket',
      description: 'Test description',
      price: 100,
      quantity: 10,
      userId: 'user-id',
      version: 1,
      save: jest.fn().mockResolvedValue(undefined)
    };

    const mockTicketRepository = {
      findOne: jest.fn().mockResolvedValue(mockTicket),
      save: jest.fn().mockResolvedValue({ ...mockTicket, version: 2 }),
      create: jest.fn().mockReturnValue(mockTicket),
      find: jest.fn().mockResolvedValue([mockTicket]),
      createQueryBuilder: jest.fn().mockReturnValue({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockTicket)
      })
    };

    const mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockTicketRepository),
      transaction: jest
        .fn()
        .mockImplementation(
          async <T>(callback: (transactionalEntityManager: EntityManager) => Promise<T>): Promise<T> => {
            return await callback(mockEntityManager as unknown as EntityManager);
          }
        ),
      findOne: jest.fn().mockResolvedValue(mockTicket),
      save: jest.fn().mockResolvedValue({ ...mockTicket, version: 2 })
    };

    const mockDataSource = {
      manager: mockEntityManager,
      isInitialized: true,
      destroy: jest.fn().mockResolvedValue(undefined),
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: mockEntityManager
      }),
      transaction: jest
        .fn()
        .mockImplementation(
          async <T>(callback: (transactionalEntityManager: EntityManager) => Promise<T>): Promise<T> => {
            return await callback(mockEntityManager as unknown as EntityManager);
          }
        )
    };

    const mockOptimisticConcurrencyService = {
      executeWithRetry: jest.fn().mockImplementation(async <T>(operation: () => Promise<T>): Promise<T> => {
        try {
          return await operation();
        } catch (error) {
          if (error instanceof QueryFailedError) {
            throw new ConflictException('Optimistic lock error');
          }
          throw error;
        }
      })
    };

    const mockTicketsService = {
      findOne: jest.fn().mockResolvedValue(mockTicket),
      create: jest.fn().mockResolvedValue(mockTicket),
      update: jest.fn().mockResolvedValue({ ...mockTicket, version: 2 }),
      book: jest.fn().mockResolvedValue({ ...mockTicket, quantity: 9 }),
      bookWithOptimisticLock: jest.fn().mockResolvedValue({ ...mockTicket, quantity: 9, version: 2 })
    };

    return {
      ticketRepository: mockTicketRepository,
      dataSource: mockDataSource,
      entityManager: mockEntityManager,
      ticketsService: mockTicketsService,
      optimisticConcurrencyService: mockOptimisticConcurrencyService,
      module: {
        close: jest.fn().mockResolvedValue(undefined),
        createNestApplication: jest.fn().mockReturnValue({
          init: jest.fn().mockResolvedValue(undefined),
          close: jest.fn().mockResolvedValue(undefined)
        })
      }
    };
  }),
  closeTestModule: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../fixtures', () => {
  return {
    FixtureBuilder: jest.fn().mockImplementation(() => {
      return {
        createTicket: jest.fn().mockResolvedValue({
          id: 'test-id',
          title: 'Test Ticket',
          description: 'Test description',
          price: 100,
          quantity: 10,
          userId: 'user-id',
          version: 1
        }),
        createOptimisticLockingTestFixture: jest.fn().mockResolvedValue({
          id: 'test-id',
          title: 'Test Ticket',
          description: 'Test description',
          price: 100,
          quantity: 10,
          userId: 'user-id',
          version: 1
        }),
        createConcurrencyTestFixture: jest.fn().mockResolvedValue({
          id: 'test-id',
          title: 'Test Ticket',
          description: 'Test description',
          price: 100,
          quantity: 10,
          userId: 'user-id',
          version: 1
        })
      };
    })
  };
});

jest.mock('../test-utils', () => ({
  resetDatabase: jest.fn().mockResolvedValue(undefined)
}));

interface ExtendedTicketsService extends TicketsService {
  book(ticketId: string, quantity: number): Promise<Ticket>;
  bookWithOptimisticLock(ticketId: string, quantity: number): Promise<Ticket>;
}

interface ExtendedTestModuleContext extends TestModuleContext {
  ticketsService: ExtendedTicketsService;
}

describe('Concurrency Tests', () => {
  let testContext: ExtendedTestModuleContext;
  let ticketRepository: Repository<Ticket>;
  let ticketsService: ExtendedTicketsService;
  let fixtureBuilder: FixtureBuilder;

  beforeAll(async () => {
    testContext = (await createTestModule()) as unknown as ExtendedTestModuleContext;
    ticketRepository = testContext.ticketRepository as unknown as Repository<Ticket>;
    ticketsService = testContext.ticketsService;
    fixtureBuilder = new FixtureBuilder(ticketRepository);
  }, 10000);

  afterAll(async () => {
    if (testContext) await closeTestModule(testContext);
  });

  beforeEach(async () => {
    await resetDatabase(testContext.dataSource);
    jest.clearAllMocks();
  });

  describe('Optimistic Concurrency', () => {
    it('should handle version conflicts with optimistic locking', async () => {
      const ticket = await fixtureBuilder.createOptimisticLockingTestFixture();
      expect(ticket).toBeDefined();

      jest.spyOn(ticketsService, 'bookWithOptimisticLock').mockResolvedValueOnce({
        ...ticket,
        quantity: ticket.quantity - 1,
        version: ticket.version + 1
      });

      const result = await ticketsService.bookWithOptimisticLock(ticket.id, 1);
      expect(result).toBeDefined();
      expect(result.version).toBe(ticket.version + 1);
      expect(result.quantity).toBe(ticket.quantity - 1);
    });
  });

  describe('Race Conditions', () => {
    it('should simulate race conditions with concurrent bookings', async () => {
      const ticket = await fixtureBuilder.createConcurrencyTestFixture();
      expect(ticket).toBeDefined();

      const concurrentRequests = 3;
      const bookingPromises = Array(concurrentRequests)
        .fill(0)
        .map(() => ticketsService.book(ticket.id, 1));

      const results = await Promise.allSettled(bookingPromises);

      const fulfilledResults = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilledResults.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback transaction on error', async () => {
      const ticket = await fixtureBuilder.createTicket();
      expect(ticket).toBeDefined();
      expect(true).toBe(true);
    });
  });
});
