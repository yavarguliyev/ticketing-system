import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsolationLevel } from 'typeorm/driver/types/IsolationLevel';

import { TransactionService } from './transaction.service';
import { Ticket } from '../../../modules/tickets/entities/ticket.entity';

export interface IsolationTestResult {
  transactionType: string;
  isolationLevel: IsolationLevel;
  success: boolean;
  ticketsBefore: Ticket[];
  ticketsAfter: Ticket[];
  error?: string;
  executionTimeMs: number;
}

@Injectable()
export class IsolationLevelService {
  constructor (
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    private readonly transactionService: TransactionService
  ) {}

  async testReadUncommitted (ticketId: string): Promise<IsolationTestResult> {
    const startTime = Date.now();
    const ticketsBefore = await this.ticketsRepository.find({ where: { id: ticketId } });
    let success = false;
    let error = undefined;
    let ticketsAfter: Ticket[] = [];

    try {
      await this.transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const ticket = await ticketRepo.findOne({ where: { id: ticketId } });

        if (!ticket) {
          throw new Error(`Ticket with ID ${ticketId} not found`);
        }

        ticket.quantity -= 1;
        await ticketRepo.save(ticket);

        await this.transactionService.execute(async (innerManager) => {
          const innerTicket = await innerManager.getRepository(Ticket).findOne({
            where: { id: ticketId }
          });

          ticketsAfter = innerTicket ? [innerTicket] : [];
        }, 'READ UNCOMMITTED');

        throw new Error('Rollback first transaction');
      }, 'READ UNCOMMITTED');
    } catch (err) {
      if (err instanceof Error && err.message !== 'Rollback first transaction') {
        error = err.message;
      } else {
        success = true;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      transactionType: 'Dirty Read',
      isolationLevel: 'READ UNCOMMITTED',
      success,
      ticketsBefore,
      ticketsAfter,
      error,
      executionTimeMs
    };
  }

  async testReadCommitted (ticketId: string): Promise<IsolationTestResult> {
    const startTime = Date.now();
    const ticketsBefore = await this.ticketsRepository.find({ where: { id: ticketId } });
    let success = false;
    let error = undefined;
    let ticketsAfter: Ticket[] = [];

    try {
      const tx1Promise = this.transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const ticket = await ticketRepo.findOne({ where: { id: ticketId } });

        if (!ticket) {
          throw new Error(`Ticket with ID ${ticketId} not found`);
        }

        ticket.quantity -= 1;
        await ticketRepo.save(ticket);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        return ticket;
      }, 'READ COMMITTED');

      await new Promise((resolve) => setTimeout(resolve, 500));

      const tx2Promise = this.transactionService.execute(async (manager) => {
        const ticket = await manager.getRepository(Ticket).findOne({
          where: { id: ticketId }
        });

        ticketsAfter = ticket ? [ticket] : [];
        return ticket;
      }, 'READ COMMITTED');

      await Promise.all([tx1Promise, tx2Promise]);
      success = true;
    } catch (err) {
      if (err instanceof Error) {
        error = err.message;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      transactionType: 'Non-Repeatable Read',
      isolationLevel: 'READ COMMITTED',
      success,
      ticketsBefore,
      ticketsAfter,
      error,
      executionTimeMs
    };
  }

  async testRepeatableRead (ticketId: string): Promise<IsolationTestResult> {
    const startTime = Date.now();
    const ticketsBefore = await this.ticketsRepository.find({ where: { id: ticketId } });
    let success = false;
    let error = undefined;
    let ticketsAfter: Ticket[] = [];

    try {
      const tx1Promise = this.transactionService.execute(async (manager) => {
        const firstRead = await manager.getRepository(Ticket).findOne({
          where: { id: ticketId }
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const secondRead = await manager.getRepository(Ticket).findOne({
          where: { id: ticketId }
        });

        ticketsAfter = secondRead ? [secondRead] : [];

        return { firstRead, secondRead };
      }, 'REPEATABLE READ');

      await new Promise((resolve) => setTimeout(resolve, 300));

      const tx2Promise = this.transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const ticket = await ticketRepo.findOne({ where: { id: ticketId } });

        if (!ticket) {
          throw new Error(`Ticket with ID ${ticketId} not found`);
        }

        ticket.quantity -= 1;
        return ticketRepo.save(ticket);
      }, 'REPEATABLE READ');

      const [tx1Result] = await Promise.all([tx1Promise, tx2Promise]);
      success = tx1Result.firstRead?.quantity === tx1Result.secondRead?.quantity;
    } catch (err) {
      if (err instanceof Error) {
        error = err.message;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      transactionType: 'Repeatable Read',
      isolationLevel: 'REPEATABLE READ',
      success,
      ticketsBefore,
      ticketsAfter,
      error,
      executionTimeMs
    };
  }

  async testSerializable (ticketId: string): Promise<IsolationTestResult> {
    const startTime = Date.now();
    const ticketsBefore = await this.ticketsRepository.find({ where: { id: ticketId } });
    let success = false;
    let error = undefined;
    let ticketsAfter: Ticket[] = [];

    try {
      const tx1Promise = this.transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const tickets = await ticketRepo.find({
          where: { quantity: ticketsBefore[0]?.quantity }
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const ticket = await ticketRepo.findOne({ where: { id: ticketId } });

        if (!ticket) {
          throw new Error(`Ticket with ID ${ticketId} not found`);
        }

        ticket.quantity -= 1;
        await ticketRepo.save(ticket);

        return tickets;
      }, 'SERIALIZABLE');

      await new Promise((resolve) => setTimeout(resolve, 300));

      const tx2Promise = this.transactionService.execute(async (manager) => {
        const ticketRepo = manager.getRepository(Ticket);
        const ticket = await ticketRepo.findOne({ where: { id: ticketId } });

        if (!ticket) {
          throw new Error(`Ticket with ID ${ticketId} not found`);
        }

        ticket.quantity += 1;
        const savedTicket = await ticketRepo.save(ticket);
        ticketsAfter = [savedTicket];
        return savedTicket;
      }, 'SERIALIZABLE');

      try {
        await Promise.all([tx1Promise, tx2Promise]);
        success = true;
      } catch (err) {
        if (err instanceof Error) {
          error = err.message;
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        error = err.message;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      transactionType: 'Serialization Anomaly',
      isolationLevel: 'SERIALIZABLE',
      success,
      ticketsBefore,
      ticketsAfter,
      error,
      executionTimeMs
    };
  }
}
