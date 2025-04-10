import { Controller, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiParam, ApiQuery } from '@nestjs/swagger';

import { TicketsService } from '../services/tickets.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { Ticket } from '../entities/ticket.entity';
import { BookTicketDto } from '../dto/book-ticket.dto';
import { OptimisticConcurrencyService } from '../../../shared/database/services/optimistic-concurrency.service';
import {
  ApiCreateEndpoint,
  ApiGetAllEndpoint,
  ApiGetOneEndpoint,
  ApiUpdateEndpoint,
  ApiDeleteEndpoint,
  ApiBookTicketEndpoint,
  ApiOptimisticBookTicketEndpoint,
  ApiCheckAvailabilityEndpoint,
  ApiEndpoint
} from '../../../shared/http/decorators';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly optimisticConcurrencyService: OptimisticConcurrencyService
  ) {}

  @ApiCreateEndpoint({ summary: 'Create a new ticket', type: Ticket })
  async create(@Body() createTicketDto: CreateTicketDto): Promise<Ticket> {
    return this.ticketsService.create(createTicketDto);
  }

  @ApiGetAllEndpoint({ summary: 'Get all tickets', type: Ticket })
  async findAll(): Promise<Ticket[]> {
    return this.ticketsService.findAll();
  }

  @ApiGetOneEndpoint({
    summary: 'Get a ticket by ID',
    path: ':id',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket' })]
  })
  async findOne(@Param('id') id: string): Promise<Ticket> {
    return this.ticketsService.findOne(id);
  }

  @ApiUpdateEndpoint({
    summary: 'Update a ticket',
    path: ':id',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to update' })]
  })
  async update(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    return this.ticketsService.update(id, updateTicketDto);
  }

  @ApiDeleteEndpoint({
    summary: 'Delete a ticket',
    path: ':id',
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to delete' })]
  })
  async remove(@Param('id') id: string): Promise<void> {
    return this.ticketsService.remove(id);
  }

  @ApiBookTicketEndpoint({
    summary: 'Book tickets with pessimistic locking to prevent overselling',
    path: ':id/book',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to book' })]
  })
  async bookTicket(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicket(id, userId, bookTicketDto.quantity);
  }

  @ApiBookTicketEndpoint({
    summary: 'Release previously booked tickets',
    path: ':id/release',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to release' })]
  })
  async releaseTicket(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.releaseTicket(id, userId, bookTicketDto.quantity);
  }

  @ApiCheckAvailabilityEndpoint({
    summary: 'Check ticket availability',
    path: ':id/availability',
    extraDecorators: [
      ApiParam({ name: 'id', description: 'The ID of the ticket to check' }),
      ApiQuery({ name: 'quantity', description: 'Number of tickets to check availability for', required: true })
    ]
  })
  async checkAvailability(@Param('id') id: string, @Query('quantity') quantity: number): Promise<{ available: boolean }> {
    const available = await this.ticketsService.checkAvailability(id, quantity);
    return { available };
  }

  @ApiOptimisticBookTicketEndpoint({
    summary: 'Book tickets using optimistic concurrency control',
    path: ':id/book-optimistic',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to book' })]
  })
  async bookTicketOptimistic(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicketOptimistic(id, userId, bookTicketDto.quantity);
  }

  @ApiOptimisticBookTicketEndpoint({
    summary: 'Release tickets using optimistic concurrency control',
    path: ':id/release-optimistic',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to release' })]
  })
  async releaseTicketOptimistic(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.releaseTicketOptimistic(id, userId, bookTicketDto.quantity);
  }

  @ApiCheckAvailabilityEndpoint({
    summary: 'Check ticket availability using optimistic concurrency',
    path: ':id/availability-optimistic',
    extraDecorators: [
      ApiParam({ name: 'id', description: 'The ID of the ticket to check' }),
      ApiQuery({ name: 'quantity', description: 'Number of tickets to check availability for', required: true })
    ]
  })
  async checkAvailabilityOptimistic(@Param('id') id: string, @Query('quantity') quantity: number): Promise<{ available: boolean }> {
    const available = await this.ticketsService.checkAvailabilityOptimistic(id, quantity);
    return { available };
  }

  @ApiEndpoint({
    summary: 'Test optimistic concurrency with multiple updates',
    method: 'POST',
    path: ':id/concurrent-test',
    rateLimit: 'SENSITIVE',
    responses: [
      { status: 200, description: 'All updates completed successfully' },
      { status: 409, description: 'Version conflict detected' }
    ],
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to test with' })]
  })
  async testOptimisticConcurrency(@Param('id') id: string): Promise<{ message: string; originalVersion: number; finalVersion: number; updates: number }> {
    const originalTicket = await this.ticketsService.findOne(id);
    const originalVersion = originalTicket.version;

    const updateCount = 5;
    let successfulUpdates = 0;

    const updateOperations = Array(updateCount)
      .fill(null)
      .map((_, index) => {
        const quantity = index % 2 === 0 ? 1 : -1;
        const operation = index % 2 === 0 ? 'bookTicketOptimistic' : 'releaseTicketOptimistic';

        return this.ticketsService[operation](id, 'test-user', Math.abs(quantity))
          .then(() => {
            successfulUpdates++;
            return { success: true };
          })
          .catch((error: unknown) => {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
          });
      });

    await Promise.all(updateOperations);

    const finalTicket = await this.ticketsService.findOne(id);

    return {
      message: `Completed ${successfulUpdates} out of ${updateCount} concurrent operations`,
      originalVersion,
      finalVersion: finalTicket.version,
      updates: successfulUpdates
    };
  }

  @ApiUpdateEndpoint({
    summary: 'Update a ticket with retry mechanism',
    path: ':id/with-retry',
    type: Ticket,
    responses: [{ status: 409, description: 'Version conflict detected after max retries.' }],
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to update' })]
  })
  async updateWithRetry(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    return this.optimisticConcurrencyService.executeWithRetry(() => {
      return this.ticketsService.update(id, updateTicketDto);
    });
  }

  @ApiBookTicketEndpoint({
    summary: 'Book tickets with READ UNCOMMITTED isolation',
    path: ':id/book-read-uncommitted',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to book' })]
  })
  async bookTicketReadUncommitted(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicketWithIsolation(id, userId, bookTicketDto.quantity, 'READ UNCOMMITTED');
  }

  @ApiBookTicketEndpoint({
    summary: 'Book tickets with READ COMMITTED isolation',
    path: ':id/book-read-committed',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to book' })]
  })
  async bookTicketReadCommitted(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicketWithIsolation(id, userId, bookTicketDto.quantity, 'READ COMMITTED');
  }

  @ApiBookTicketEndpoint({
    summary: 'Book tickets with REPEATABLE READ isolation',
    path: ':id/book-repeatable-read',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to book' })]
  })
  async bookTicketRepeatableRead(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicketWithIsolation(id, userId, bookTicketDto.quantity, 'REPEATABLE READ');
  }

  @ApiBookTicketEndpoint({
    summary: 'Book tickets with SERIALIZABLE isolation',
    path: ':id/book-serializable',
    type: Ticket,
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to book' })]
  })
  async bookTicketSerializable(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicketWithIsolation(id, userId, bookTicketDto.quantity, 'SERIALIZABLE');
  }

  @ApiEndpoint({
    summary: 'Test isolation level anomalies',
    method: 'GET',
    path: ':id/test-isolation-anomalies',
    rateLimit: 'MEDIUM',
    responses: [
      { status: 200, description: 'Test results for different anomalies' },
      { status: 404, description: 'Ticket not found.' }
    ],
    extraDecorators: [ApiParam({ name: 'id', description: 'The ID of the ticket to test with' })]
  })
  async testIsolationAnomalies(@Param('id') id: string): Promise<{
    dirtyRead: { original: number; uncommitted: number; afterRollback: number };
    nonRepeatableRead: { firstRead: number; secondRead: number; changed: boolean };
    phantomRead: { firstCount: number; secondCount: number; isPhantom: boolean };
  }> {
    const dirtyRead = await this.ticketsService.simulateDirtyRead(id);
    const nonRepeatableRead = await this.ticketsService.simulateNonRepeatableRead(id);

    const ticket = await this.ticketsService.findOne(id);
    const minPrice = ticket.price * 0.7;
    const maxPrice = ticket.price * 1.3;

    const phantomRead = await this.ticketsService.simulatePhantomRead(minPrice, maxPrice);

    return {
      dirtyRead,
      nonRepeatableRead,
      phantomRead
    };
  }
}
