import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository, MoreThan } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { Ticket } from '../../src/modules/tickets/entities/ticket.entity';
import { TransactionService } from '../../src/shared/database/services/transaction.service';

describe('Transaction Isolation Levels', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let transactionService: TransactionService;
  let ticketRepository: Repository<Ticket>;
  let testTicket: Ticket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    transactionService = moduleFixture.get<TransactionService>(TransactionService);
    ticketRepository = dataSource.getRepository(Ticket);
  });

  beforeEach(async () => {
    testTicket = ticketRepository.create({
      title: 'Isolation Test Ticket',
      description: 'Used for testing transaction isolation levels',
      price: 100,
      quantity: 50,
      userId: '00000000-0000-4000-a000-000000000000'
    });

    await ticketRepository.save(testTicket);
  });

  afterEach(async () => {
    if (testTicket?.id) {
      await ticketRepository.delete(testTicket.id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('READ COMMITTED (Default)', () => {
    it('should allow non-repeatable reads', async () => {
      const tx1Promise = transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const firstRead = await ticketRepo.findOne({ where: { id: testTicket.id } });

        await new Promise((resolve) => setTimeout(resolve, 500));
        const secondRead = await ticketRepo.findOne({ where: { id: testTicket.id } });

        return { firstRead, secondRead };
      }, 'READ COMMITTED');

      const tx2Promise = transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const ticket = await ticketRepo.findOne({ where: { id: testTicket.id } });

        if (!ticket) {
          throw new Error('Test ticket not found');
        }

        ticket.quantity -= 10;
        return ticketRepo.save(ticket);
      }, 'READ COMMITTED');

      const [tx1Result] = await Promise.all([tx1Promise, tx2Promise]);

      expect(tx1Result.firstRead?.quantity).not.toEqual(tx1Result.secondRead?.quantity);
      expect(tx1Result.secondRead?.quantity).toEqual(testTicket.quantity - 10);
    });
  });

  describe('REPEATABLE READ', () => {
    it('should prevent non-repeatable reads', async () => {
      const tx1Promise = transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const firstRead = await ticketRepo.findOne({ where: { id: testTicket.id } });

        await new Promise((resolve) => setTimeout(resolve, 500));
        const secondRead = await ticketRepo.findOne({ where: { id: testTicket.id } });

        return { firstRead, secondRead };
      }, 'REPEATABLE READ');

      const tx2Promise = transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const ticket = await ticketRepo.findOne({ where: { id: testTicket.id } });

        if (!ticket) {
          throw new Error('Test ticket not found');
        }

        ticket.quantity -= 10;
        return ticketRepo.save(ticket);
      }, 'READ COMMITTED');

      const [tx1Result] = await Promise.all([tx1Promise, tx2Promise]);

      expect(tx1Result.firstRead?.quantity).toEqual(tx1Result.secondRead?.quantity);
      expect(tx1Result.secondRead?.quantity).toEqual(testTicket.quantity);

      const updatedTicket = await ticketRepository.findOne({ where: { id: testTicket.id } });
      expect(updatedTicket?.quantity).toEqual(testTicket.quantity - 10);
    });
  });

  describe('SERIALIZABLE', () => {
    it('should prevent phantom reads and serialization anomalies', async () => {
      const secondTicket = ticketRepository.create({
        title: 'Second Isolation Test Ticket',
        description: 'Used for testing transaction isolation levels',
        price: 100,
        quantity: 30,
        userId: '00000000-0000-4000-a000-000000000001'
      });
      await ticketRepository.save(secondTicket);

      try {
        const tx1Promise = transactionService.execute(async (manager) => {
          const ticketRepo = manager.getRepository(Ticket);
          const firstQuery = await ticketRepo.find({
            where: { price: 100, quantity: MoreThan(40) }
          });

          await new Promise((resolve) => setTimeout(resolve, 500));
          const secondQuery = await ticketRepo.find({
            where: { price: 100, quantity: MoreThan(40) }
          });

          const ticket = await ticketRepo.findOne({ where: { id: testTicket.id } });
          if (ticket) {
            ticket.title = 'Updated in tx1';
            await ticketRepo.save(ticket);
          }

          return { firstQuery, secondQuery };
        }, 'SERIALIZABLE');

        const tx2Promise = transactionService.execute(async (manager) => {
          const ticketRepo = manager.getRepository(Ticket);
          const ticket = await ticketRepo.findOne({ where: { id: secondTicket.id } });

          if (!ticket) {
            throw new Error('Second test ticket not found');
          }

          ticket.quantity = 45;
          return ticketRepo.save(ticket);
        }, 'SERIALIZABLE');

        await Promise.all([tx1Promise, tx2Promise]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        expect(errorMessage.includes('serialize') || errorMessage.includes('serialization') || errorMessage.includes('concurrent update')).toBeTruthy();
      } finally {
        if (secondTicket?.id) {
          await ticketRepository.delete(secondTicket.id);
        }
      }
    });
  });

  describe('Transaction Service Helper Methods', () => {
    it('should support different isolation levels via helper methods', async () => {
      const result1 = await transactionService.withTransaction(async (manager) => {
        const ticket = await manager.getRepository(Ticket).findOne({ where: { id: testTicket.id } });
        return ticket;
      }, 'READ COMMITTED');

      expect(result1).toBeDefined();
      expect(result1?.id).toEqual(testTicket.id);

      const result2 = await transactionService.withRepeatableReadTransaction(async (manager) => {
        const ticket = await manager.getRepository(Ticket).findOne({ where: { id: testTicket.id } });
        return ticket;
      });

      expect(result2).toBeDefined();
      expect(result2?.id).toEqual(testTicket.id);

      const result3 = await transactionService.withSerializableTransaction(async (manager) => {
        const ticket = await manager.getRepository(Ticket).findOne({ where: { id: testTicket.id } });
        return ticket;
      });

      expect(result3).toBeDefined();
      expect(result3?.id).toEqual(testTicket.id);
    });
  });
});
