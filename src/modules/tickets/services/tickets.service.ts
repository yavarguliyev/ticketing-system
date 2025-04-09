import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { TransactionService } from '../../../shared/database/services/transaction.service';
import { Transaction } from '../../../shared/http/decorators/transaction.decorator';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    private readonly transactionService: TransactionService
  ) {}

  @Transaction({ isolationLevel: 'READ COMMITTED' })
  async create(createTicketDto: CreateTicketDto): Promise<Ticket> {
    const ticket = this.ticketsRepository.create({
      ...createTicketDto,
      userId: '123e4567-e89b-12d3-a456-426614174000'
    });
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

  @Transaction({ isolationLevel: 'REPEATABLE READ' })
  async update(id: string, updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ where: { id } });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      Object.assign(ticket, updateTicketDto);
      return ticketRepository.save(ticket);
    }, 'REPEATABLE READ');
  }

  @Transaction({ isolationLevel: 'READ COMMITTED' })
  async remove(id: string): Promise<void> {
    return this.transactionService.execute(async (entityManager) => {
      const ticketRepository = entityManager.getRepository(Ticket);
      const ticket = await ticketRepository.findOne({ where: { id } });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      await ticketRepository.remove(ticket);
    }, 'READ COMMITTED');
  }

  async bookTicket(id: string, userId: string, quantity: number): Promise<Ticket> {
    return this.transactionService.withSerializableTransaction(async (entityManager) => {
      const queryRunner = entityManager.queryRunner;

      if (!queryRunner) {
        throw new InternalServerErrorException('Query runner not available');
      }

      await queryRunner.query('SET LOCAL statement_timeout = 3000');

      const ticketRepository = entityManager.getRepository(Ticket);

      const ticket = await ticketRepository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write', onLocked: 'nowait' }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      if (ticket.quantity < quantity) {
        throw new ConflictException(
          `Not enough tickets available. Requested: ${quantity}, Available: ${ticket.quantity}`
        );
      }

      ticket.quantity -= quantity;

      return ticketRepository.save(ticket);
    });
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

  async bookTicketOptimistic(id: string, userId: string, quantity: number, retryCount = 3): Promise<Ticket> {
    try {
      return await this.transactionService.execute(async (entityManager) => {
        const ticketRepository = entityManager.getRepository(Ticket);

        const ticket = await ticketRepository.findOne({ where: { id } });

        if (!ticket) {
          throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        if (ticket.quantity < quantity) {
          throw new ConflictException(
            `Not enough tickets available. Requested: ${quantity}, Available: ${ticket.quantity}`
          );
        }

        const initialVersion = ticket.version;
        const newQuantity = ticket.quantity - quantity;

        const updateResult = await ticketRepository
          .createQueryBuilder()
          .update(Ticket)
          .set({
            quantity: newQuantity,
            version: () => `version + 1`
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
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof QueryFailedError &&
          (error.message.includes('could not serialize access due to concurrent update') ||
            error.message.includes('version check failed')))
      ) {
        if (retryCount > 0) {
          const delay = Math.floor(Math.random() * 100) + 50;
          await new Promise((resolve) => setTimeout(resolve, delay));

          console.log(`Retrying bookTicketOptimistic for ticket ${id}, ${retryCount} retries left`);

          return this.bookTicketOptimistic(id, userId, quantity, retryCount - 1);
        } else {
          throw new ConflictException('Failed to book tickets due to concurrent updates. Please try again.');
        }
      }
      throw error;
    }
  }

  async releaseTicketOptimistic(id: string, userId: string, quantity: number, retryCount = 3): Promise<Ticket> {
    try {
      return await this.transactionService.execute(async (entityManager) => {
        const ticketRepository = entityManager.getRepository(Ticket);

        const ticket = await ticketRepository.findOne({ where: { id } });

        if (!ticket) {
          throw new NotFoundException(`Ticket with ID ${id} not found`);
        }

        const initialVersion = ticket.version;
        const newQuantity = ticket.quantity + quantity;

        const updateResult = await ticketRepository
          .createQueryBuilder()
          .update(Ticket)
          .set({
            quantity: newQuantity,
            version: () => `version + 1`
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
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof QueryFailedError &&
          (error.message.includes('could not serialize access due to concurrent update') ||
            error.message.includes('version check failed')))
      ) {
        if (retryCount > 0) {
          const delay = Math.floor(Math.random() * 100) + 50;
          await new Promise((resolve) => setTimeout(resolve, delay));

          console.log(`Retrying releaseTicketOptimistic for ticket ${id}, ${retryCount} retries left`);

          return this.releaseTicketOptimistic(id, userId, quantity, retryCount - 1);
        } else {
          throw new ConflictException('Failed to release tickets due to concurrent updates. Please try again.');
        }
      }
      throw error;
    }
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
}
