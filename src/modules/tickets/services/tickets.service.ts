import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOneOptions } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { Ticket } from '../entities/ticket.entity';
import { TransactionService } from '../../../shared/database/services/transaction.service';
import { OptimisticConcurrencyService } from '../../../shared/database/services/optimistic-concurrency.service';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    private readonly transactionService: TransactionService,
    private readonly optimisticConcurrencyService: OptimisticConcurrencyService
  ) {}

  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    const ticket = this.ticketsRepository.create(createTicketDto);
    return this.ticketsRepository.save(ticket);
  }

  async findAll(): Promise<Ticket[]> {
    return this.ticketsRepository.find();
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async update(id: string, updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    const ticket = await this.findOne(id);

    Object.assign(ticket, updateTicketDto);

    return this.ticketsRepository.save(ticket);
  }

  async remove(id: string): Promise<void> {
    const result = await this.ticketsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
  }

  async bookTicket(id: string, userId: string, quantity: number): Promise<Ticket> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const ticket = await ticketRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write', onLocked: 'nowait' }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      if (ticket.quantity < quantity) {
        throw new ConflictException(`Not enough tickets available. Requested: ${quantity}, Available: ${ticket.quantity}`);
      }

      ticket.quantity -= quantity;

      return ticketRepository.save(ticket);
    }, 'SERIALIZABLE');
  }

  async releaseTicket(id: string, userId: string, quantity: number): Promise<Ticket> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const ticket = await ticketRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write', onLocked: 'nowait' }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      ticket.quantity += quantity;

      return ticketRepository.save(ticket);
    }, 'SERIALIZABLE');
  }

  async checkAvailability(id: string, quantity: number): Promise<boolean> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const ticket = await ticketRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_read' }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      return ticket.quantity >= quantity;
    }, 'REPEATABLE READ');
  }

  async bookTicketOptimistic(id: string, userId: string, quantity: number): Promise<Ticket> {
    return this.optimisticConcurrencyService.executeWithRetry(
      async () => {
        return this.transactionService.execute(async (entityManager) => {
          const ticketRepository = entityManager.getRepository(Ticket);

          const ticket = await ticketRepository.findOne({ where: { id } });

          if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
          }

          if (ticket.quantity < quantity) {
            throw new ConflictException(`Not enough tickets available. Requested: ${quantity}, Available: ${ticket.quantity}`);
          }

          const initialVersion = ticket.version;

          ticket.quantity -= quantity;

          const updateResult = await ticketRepository
            .createQueryBuilder()
            .update(Ticket)
            .set({
              quantity: ticket.quantity
            })
            .where('id = :id', { id })
            .andWhere('version = :version', { version: initialVersion })
            .execute();

          if (updateResult.affected === 0) {
            throw new ConflictException('Version conflict detected. The ticket was modified by another transaction.');
          }

          const updatedTicket = await ticketRepository.findOne({ where: { id } });
          if (!updatedTicket) {
            throw new NotFoundException(`Ticket with ID ${id} not found after update`);
          }

          return updatedTicket;
        }, 'READ COMMITTED');
      },
      { maxRetries: 5 },
      `booking ticket ${id}`
    );
  }

  async releaseTicketOptimistic(id: string, userId: string, quantity: number): Promise<Ticket> {
    return this.optimisticConcurrencyService.executeWithRetry(
      async () => {
        return this.transactionService.execute(async (entityManager) => {
          const ticketRepository = entityManager.getRepository(Ticket);

          const ticket = await ticketRepository.findOne({ where: { id } });

          if (!ticket) {
            throw new NotFoundException(`Ticket with ID ${id} not found`);
          }

          const initialVersion = ticket.version;

          ticket.quantity += quantity;

          const updateResult = await ticketRepository
            .createQueryBuilder()
            .update(Ticket)
            .set({
              quantity: ticket.quantity
            })
            .where('id = :id', { id })
            .andWhere('version = :version', { version: initialVersion })
            .execute();

          if (updateResult.affected === 0) {
            throw new ConflictException('Version conflict detected. The ticket was modified by another transaction.');
          }

          const updatedTicket = await ticketRepository.findOne({ where: { id } });
          if (!updatedTicket) {
            throw new NotFoundException(`Ticket with ID ${id} not found after update`);
          }

          return updatedTicket;
        }, 'READ COMMITTED');
      },
      { maxRetries: 5 },
      `releasing ticket ${id}`
    );
  }

  async checkAvailabilityOptimistic(id: string, quantity: number): Promise<boolean> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const ticket = await ticketRepository.findOne({ where: { id } });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      return ticket.quantity >= quantity;
    }, 'READ COMMITTED');
  }

  async bookTicketWithIsolation(id: string, userId: string, quantity: number, isolationLevel: IsolationLevel): Promise<Ticket> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const options: FindOneOptions<Ticket> = {
        where: { id },
        ...(isolationLevel === 'SERIALIZABLE' || isolationLevel === 'REPEATABLE READ' ? { lock: { mode: 'pessimistic_write', onLocked: 'nowait' } } : {})
      };

      const ticket = await ticketRepository.findOne(options);

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      if (ticket.quantity < quantity) {
        throw new ConflictException(`Not enough tickets available. Requested: ${quantity}, Available: ${ticket.quantity}`);
      }

      ticket.quantity -= quantity;

      return ticketRepository.save(ticket);
    }, isolationLevel);
  }

  async releaseTicketWithIsolation(id: string, userId: string, quantity: number, isolationLevel: IsolationLevel): Promise<Ticket> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const options: FindOneOptions<Ticket> = {
        where: { id },
        ...(isolationLevel === 'SERIALIZABLE' || isolationLevel === 'REPEATABLE READ' ? { lock: { mode: 'pessimistic_write', onLocked: 'nowait' } } : {})
      };

      const ticket = await ticketRepository.findOne(options);

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      ticket.quantity += quantity;

      return ticketRepository.save(ticket);
    }, isolationLevel);
  }

  async simulateDirtyRead(id: string): Promise<{ original: number; uncommitted: number; afterRollback: number }> {
    const originalTicket = await this.findOne(id);
    const original = originalTicket.quantity;

    const queryRunner = this.ticketsRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ UNCOMMITTED');

    try {
      await queryRunner.manager.update(Ticket, id, { quantity: original - 5 });

      const uncommittedResult = await this.transactionService.execute(async (entityManager) => {
        return entityManager.getRepository(Ticket).findOne({ where: { id } });
      }, 'READ UNCOMMITTED');

      const uncommitted = uncommittedResult ? uncommittedResult.quantity : original;

      await queryRunner.rollbackTransaction();

      const afterRollbackTicket = await this.findOne(id);
      const afterRollback = afterRollbackTicket.quantity;

      return { original, uncommitted, afterRollback };
    } finally {
      await queryRunner.release();
    }
  }

  async simulateNonRepeatableRead(id: string): Promise<{ firstRead: number; secondRead: number; changed: boolean }> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const firstTicket = await ticketRepository.findOne({ where: { id } });
      if (!firstTicket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }
      const firstRead = firstTicket.quantity;

      await this.ticketsRepository.update(id, { quantity: firstRead + 3 });

      const secondTicket = await ticketRepository.findOne({ where: { id } });
      const secondRead = secondTicket ? secondTicket.quantity : firstRead;

      await this.ticketsRepository.update(id, { quantity: firstRead });

      return {
        firstRead,
        secondRead,
        changed: firstRead !== secondRead
      };
    }, 'READ COMMITTED');
  }

  async simulatePhantomRead(minPrice: number, maxPrice: number): Promise<{ firstCount: number; secondCount: number; isPhantom: boolean }> {
    const tempTicket = this.ticketsRepository.create({
      title: 'Phantom Ticket',
      description: 'This ticket will appear as a phantom read',
      price: minPrice + (maxPrice - minPrice) / 2,
      quantity: 10,
      userId: '123e4567-e89b-12d3-a456-426614174000'
    });

    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);

      const firstQuery = await ticketRepository.count({
        where: {
          price: Between(minPrice, maxPrice)
        }
      });

      await this.ticketsRepository.save(tempTicket);

      const secondQuery = await ticketRepository.count({
        where: {
          price: Between(minPrice, maxPrice)
        }
      });

      await this.ticketsRepository.delete(tempTicket.id);

      return {
        firstCount: firstQuery,
        secondCount: secondQuery,
        isPhantom: firstQuery !== secondQuery
      };
    }, 'READ COMMITTED');
  }
}
