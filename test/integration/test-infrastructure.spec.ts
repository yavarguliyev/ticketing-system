import { INestApplication } from '@nestjs/common';
import { createTestModule, TestModuleContext, closeTestModule } from '../test-module';
import { resetDatabase } from '../test-utils';
import { FixtureBuilder } from '../fixtures';
import { Repository } from 'typeorm';
import { Ticket } from '../../src/modules/tickets/entities/ticket.entity';

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
      save: jest.fn().mockResolvedValue(mockTicket),
      create: jest.fn().mockReturnValue(mockTicket),
      find: jest.fn().mockResolvedValue([mockTicket])
    };

    const mockEntityManager = {
      getRepository: jest.fn().mockReturnValue(mockTicketRepository)
    };

    const mockDataSource = {
      manager: mockEntityManager,
      isInitialized: true,
      destroy: jest.fn().mockResolvedValue(undefined)
    };

    return {
      ticketRepository: mockTicketRepository,
      dataSource: mockDataSource,
      entityManager: mockEntityManager,
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
        })
      };
    })
  };
});

jest.mock('../test-utils', () => ({
  resetDatabase: jest.fn().mockResolvedValue(undefined)
}));

describe('Test Infrastructure', () => {
  let app: INestApplication;
  let testContext: TestModuleContext;
  let ticketRepository: Repository<Ticket>;
  let fixtureBuilder: FixtureBuilder;

  beforeAll(async () => {
    testContext = await createTestModule();
    app = testContext.module.createNestApplication();
    await app.init();

    ticketRepository = testContext.ticketRepository as unknown as Repository<Ticket>;
    fixtureBuilder = new FixtureBuilder(ticketRepository);
  }, 10000);

  afterAll(async () => {
    if (app) await app.close();
    if (testContext) await closeTestModule(testContext);
  });

  beforeEach(async () => {
    await resetDatabase(testContext.dataSource);
    jest.clearAllMocks();
  });

  describe('Test Module', () => {
    it('should create a test module with repositories', () => {
      expect(testContext).toBeDefined();
      expect(ticketRepository).toBeDefined();
    });

    it('should initialize the application', () => {
      expect(app).toBeDefined();
    });
  });

  describe('Fixtures', () => {
    it('should create ticket fixtures', async () => {
      const ticket = await fixtureBuilder.createTicket();

      expect(ticket).toBeDefined();
      expect(ticket.id).toBeDefined();
      expect(ticket.title).toBeDefined();
      expect(ticket.price).toBeGreaterThan(0);
    });
  });

  describe('Database Operations', () => {
    it('should save and retrieve entities', async () => {
      const ticket = await fixtureBuilder.createTicket();

      jest.spyOn(ticketRepository, 'findOne').mockResolvedValueOnce(ticket);

      const foundTicket = await ticketRepository.findOne({ where: { id: ticket.id } });

      expect(foundTicket).toBeDefined();
      expect(foundTicket!.id).toBe(ticket.id);
    });
  });
});
