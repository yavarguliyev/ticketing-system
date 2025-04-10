# Transaction Isolation Level Examples

This document provides practical examples of how to use different transaction isolation levels in the ticketing system.

## Using Transaction Decorators

The simplest way to apply transaction isolation levels is through decorators.

### READ COMMITTED Example

```typescript
import { Controller, Get } from '@nestjs/common';
import { ReadCommittedTransaction } from 'src/shared/http/decorators/transaction.decorator';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @ReadCommittedTransaction()
  @Get()
  async findAll() {
    return this.ticketsService.findAll();
  }
}
```

### REPEATABLE READ Example

Use this for operations where you need to ensure consistent reads of the same data:

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { RepeatableReadTransaction } from 'src/shared/http/decorators/transaction.decorator';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @RepeatableReadTransaction()
  @Get(':id/availability')
  async checkAvailability(@Param('id') id: string, @Query('quantity') quantity: number) {
    // First check the ticket
    const ticket = await this.ticketsService.findOne(id);

    // Calculate availability
    const isAvailable = ticket.quantity >= quantity;

    // Recheck to confirm (with REPEATABLE READ, this will be consistent)
    const recheckTicket = await this.ticketsService.findOne(id);

    // Both checks should yield the same result
    return {
      available: isAvailable,
      consistentRead: ticket.quantity === recheckTicket.quantity
    };
  }
}
```

### SERIALIZABLE Example

Use this for critical operations involving complex data integrity constraints:

```typescript
import { Controller, Post, Param, Body } from '@nestjs/common';
import { SerializableTransaction } from 'src/shared/http/decorators/transaction.decorator';
import { BookTicketDto } from '../dto/book-ticket.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @SerializableTransaction({
    timeout: 10000, // 10 seconds transaction timeout
    statementTimeout: 5000 // 5 seconds statement timeout
  })
  @Post(':id/book')
  async bookTicket(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto) {
    // This entire operation will execute in a SERIALIZABLE transaction
    return this.ticketsService.bookTicket(id, bookTicketDto.userId, bookTicketDto.quantity);
  }
}
```

## Using TransactionService Directly

For more programmatic control, you can use the TransactionService directly:

```typescript
import { Injectable } from '@nestjs/common';
import { TransactionService } from 'src/shared/database/services/transaction.service';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(private readonly transactionService: TransactionService) {}

  async bookMultipleTickets(ticketIds: string[], userId: string): Promise<Ticket[]> {
    // Using the helper method for SERIALIZABLE transactions
    return this.transactionService.withSerializableTransaction(
      async (manager) => {
        const ticketRepository = manager.getRepository(Ticket);
        const bookedTickets: Ticket[] = [];

        for (const ticketId of ticketIds) {
          const ticket = await ticketRepository.findOne({ where: { id: ticketId } });

          if (!ticket) {
            throw new Error(`Ticket with ID ${ticketId} not found`);
          }

          if (ticket.quantity < 1) {
            throw new Error(`Ticket with ID ${ticketId} is sold out`);
          }

          // Update the ticket
          ticket.quantity -= 1;
          const bookedTicket = await ticketRepository.save(ticket);
          bookedTickets.push(bookedTicket);
        }

        return bookedTickets;
      },
      {
        timeout: 15000, // 15 seconds for the entire operation
        statementTimeout: 5000 // 5 seconds per statement
      }
    );
  }

  async generateTicketReport(eventId: string): Promise<any> {
    // Using REPEATABLE READ for consistent reporting
    return this.transactionService.withRepeatableReadTransaction(async (manager) => {
      const ticketRepository = manager.getRepository(Ticket);

      // All these queries will see a consistent snapshot of the database
      const totalTickets = await ticketRepository.count({ where: { eventId } });
      const soldTickets = await ticketRepository
        .createQueryBuilder('ticket')
        .where('ticket.eventId = :eventId', { eventId })
        .andWhere('ticket.quantity = 0')
        .getCount();

      const availableTickets = await ticketRepository
        .createQueryBuilder('ticket')
        .where('ticket.eventId = :eventId', { eventId })
        .andWhere('ticket.quantity > 0')
        .getCount();

      // With REPEATABLE READ, we're guaranteed that:
      // totalTickets = soldTickets + availableTickets

      return {
        totalTickets,
        soldTickets,
        availableTickets,
        averagePrice: await ticketRepository
          .createQueryBuilder('ticket')
          .where('ticket.eventId = :eventId', { eventId })
          .select('AVG(ticket.price)', 'avgPrice')
          .getRawOne()
      };
    });
  }
}
```

## Handling Conflicts

Here's how to handle conflicts that might occur with different isolation levels:

### Optimistic Concurrency with Version Checks

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { OptimisticConcurrencyService } from 'src/shared/database/services/optimistic-concurrency.service';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    private readonly optimisticConcurrencyService: OptimisticConcurrencyService
  ) {}

  async updateTicketPrice(id: string, price: number): Promise<Ticket> {
    return this.optimisticConcurrencyService.executeWithRetry(
      async () => {
        const ticket = await this.ticketsRepository.findOne({ where: { id } });

        if (!ticket) {
          throw new Error(`Ticket with ID ${id} not found`);
        }

        // The version column will be automatically incremented
        ticket.price = price;

        try {
          return await this.ticketsRepository.save(ticket);
        } catch (error) {
          if (this.optimisticConcurrencyService.isOptimisticLockError(error)) {
            throw new ConflictException('The ticket was modified by another transaction');
          }
          throw error;
        }
      },
      { maxRetries: 3 }
    );
  }
}
```

### Handling Serialization Failures

```typescript
import { Injectable, ConflictException } from '@nestjs/common';
import { TransactionService } from 'src/shared/database/services/transaction.service';
import { Ticket } from '../entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(private readonly transactionService: TransactionService) {}

  async bookTicket(id: string, userId: string, quantity: number): Promise<Ticket> {
    let retries = 0;
    const maxRetries = 3;

    while (true) {
      try {
        return await this.transactionService.withSerializableTransaction(async (manager) => {
          const ticketRepository = manager.getRepository(Ticket);
          const ticket = await ticketRepository.findOne({ where: { id } });

          if (!ticket) {
            throw new Error(`Ticket with ID ${id} not found`);
          }

          if (ticket.quantity < quantity) {
            throw new ConflictException(`Not enough tickets available (${ticket.quantity} < ${quantity})`);
          }

          ticket.quantity -= quantity;
          return ticketRepository.save(ticket);
        });
      } catch (error) {
        // Check if this is a serialization failure
        if (
          retries < maxRetries &&
          error instanceof Error &&
          (error.message.includes('could not serialize access') ||
            error.message.includes('deadlock detected') ||
            error.message.includes('concurrent update'))
        ) {
          retries++;

          // Exponential backoff with jitter
          const delay = Math.floor(100 * Math.pow(2, retries) * (0.8 + Math.random() * 0.4));
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }
  }
}
```

## Common Mistakes to Avoid

1. **Using higher isolation than needed**: SERIALIZABLE is expensive - use it only when necessary.

   ```typescript
   // WRONG: Using SERIALIZABLE for a simple read
   @SerializableTransaction()
   @Get(':id')
   async findOne(@Param('id') id: string) {
     return this.ticketsService.findOne(id);
   }

   // RIGHT: Using READ COMMITTED for a simple read
   @ReadCommittedTransaction()
   @Get(':id')
   async findOne(@Param('id') id: string) {
     return this.ticketsService.findOne(id);
   }
   ```

2. **Long-running transactions**: Keep transactions as short as possible.

   ```typescript
   // WRONG: Long transaction with unrelated operations
   @SerializableTransaction()
   async processOrder(orderId: string) {
     const order = await this.ordersRepository.findOne(orderId);
     await this.emailService.sendOrderConfirmation(order); // Slow external service call
     await this.ticketRepository.updateTicketQuantities(order.tickets);
     return order;
   }

   // RIGHT: Short transaction focused on critical operations
   async processOrder(orderId: string) {
     // First do the database updates in a transaction
     const order = await this.transactionService.withSerializableTransaction(async (manager) => {
       const orderRepo = manager.getRepository(Order);
       const order = await orderRepo.findOne(orderId);
       await manager.getRepository(Ticket).updateTicketQuantities(order.tickets);
       return order;
     });

     // Then do non-transactional work outside
     await this.emailService.sendOrderConfirmation(order);
     return order;
   }
   ```

3. **Missing error handling**: Always handle transaction conflicts appropriately.

   ```typescript
   // WRONG: No handling for serialization failures
   @SerializableTransaction()
   async bookTicket(id: string, quantity: number) {
     const ticket = await this.ticketsRepository.findOne(id);
     ticket.quantity -= quantity;
     return this.ticketsRepository.save(ticket);
   }

   // RIGHT: Proper error handling
   async bookTicket(id: string, quantity: number) {
     try {
       return await this.transactionService.withSerializableTransaction(async (manager) => {
         // Transaction logic...
       });
     } catch (error) {
       if (error instanceof QueryFailedError &&
           error.message.includes('could not serialize access')) {
         throw new ConflictException('Concurrent booking conflict, please try again');
       }
       throw error;
     }
   }
   ```
