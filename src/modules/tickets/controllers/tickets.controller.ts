import { Controller, Get, Post, Body, Param, Patch, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import { TicketsService } from '../services/tickets.service';
import { CreateTicketDto } from '../dto/create-ticket.dto';
import { UpdateTicketDto } from '../dto/update-ticket.dto';
import { Ticket } from '../entities/ticket.entity';
import { LowRateLimit, MediumRateLimit, SensitiveRateLimit } from '../../../shared/http/decorators/throttle.decorator';
import { BookTicketDto } from '../dto/book-ticket.dto';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @ApiOperation({ summary: 'Create a new ticket' })
  @ApiResponse({ status: 201, description: 'The ticket has been successfully created.', type: Ticket })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @LowRateLimit()
  @Post()
  async create(@Body() createTicketDto: CreateTicketDto): Promise<Ticket> {
    return this.ticketsService.create(createTicketDto);
  }

  @ApiOperation({ summary: 'Get all tickets' })
  @ApiResponse({ status: 200, description: 'Return all tickets.', type: [Ticket] })
  @MediumRateLimit()
  @Get()
  async findAll(): Promise<Ticket[]> {
    return this.ticketsService.findAll();
  }

  @ApiOperation({ summary: 'Get a ticket by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket' })
  @ApiResponse({ status: 200, description: 'Return the ticket.', type: Ticket })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @MediumRateLimit()
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Ticket> {
    return this.ticketsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a ticket' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to update' })
  @ApiResponse({ status: 200, description: 'The ticket has been successfully updated.', type: Ticket })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @SensitiveRateLimit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateTicketDto: UpdateTicketDto): Promise<Ticket> {
    return this.ticketsService.update(id, updateTicketDto);
  }

  @ApiOperation({ summary: 'Delete a ticket' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to delete' })
  @ApiResponse({ status: 200, description: 'The ticket has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @SensitiveRateLimit()
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.ticketsService.remove(id);
  }

  @ApiOperation({ summary: 'Book tickets with pessimistic locking to prevent overselling' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to book' })
  @ApiResponse({ status: 200, description: 'Tickets successfully booked.', type: Ticket })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 409, description: 'Not enough tickets available.' })
  @ApiResponse({ status: 423, description: 'Resource is locked by another transaction.' })
  @SensitiveRateLimit()
  @Post(':id/book')
  async bookTicket(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicket(id, userId, bookTicketDto.quantity);
  }

  @ApiOperation({ summary: 'Release previously booked tickets' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to release' })
  @ApiResponse({ status: 200, description: 'Tickets successfully released.', type: Ticket })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 423, description: 'Resource is locked by another transaction.' })
  @SensitiveRateLimit()
  @Post(':id/release')
  async releaseTicket(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.releaseTicket(id, userId, bookTicketDto.quantity);
  }

  @ApiOperation({ summary: 'Check ticket availability' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to check' })
  @ApiQuery({ name: 'quantity', description: 'Number of tickets to check availability for', required: true })
  @ApiResponse({ status: 200, description: 'Returns true if tickets are available, false otherwise.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @MediumRateLimit()
  @Get(':id/availability')
  async checkAvailability(
    @Param('id') id: string,
    @Query('quantity') quantity: number
  ): Promise<{ available: boolean }> {
    const available = await this.ticketsService.checkAvailability(id, quantity);
    return { available };
  }

  @ApiOperation({ summary: 'Book tickets using optimistic concurrency control' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to book' })
  @ApiResponse({ status: 200, description: 'The ticket has been successfully booked.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 409, description: 'Not enough tickets available.' })
  @ApiResponse({ status: 500, description: 'Failed to book tickets after retries.' })
  @SensitiveRateLimit()
  @Post(':id/book-optimistic')
  async bookTicketOptimistic(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.bookTicketOptimistic(id, userId, bookTicketDto.quantity);
  }

  @ApiOperation({ summary: 'Release tickets using optimistic concurrency control' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to release' })
  @ApiResponse({ status: 200, description: 'The tickets have been successfully released.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 500, description: 'Failed to release tickets after retries.' })
  @MediumRateLimit()
  @Post(':id/release-optimistic')
  async releaseTicketOptimistic(@Param('id') id: string, @Body() bookTicketDto: BookTicketDto): Promise<Ticket> {
    const userId = bookTicketDto.userId || 'default-user-id';
    return this.ticketsService.releaseTicketOptimistic(id, userId, bookTicketDto.quantity);
  }

  @ApiOperation({ summary: 'Check ticket availability using optimistic concurrency' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to check' })
  @ApiQuery({ name: 'quantity', description: 'Number of tickets to check availability for', required: true })
  @ApiResponse({ status: 200, description: 'Returns true if tickets are available, false otherwise.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @MediumRateLimit()
  @Get(':id/availability-optimistic')
  async checkAvailabilityOptimistic(
    @Param('id') id: string,
    @Query('quantity') quantity: number
  ): Promise<{ available: boolean }> {
    const available = await this.ticketsService.checkAvailabilityOptimistic(id, quantity);
    return { available };
  }

  @Post(':id/concurrent-test')
  @ApiOperation({ summary: 'Test optimistic concurrency with multiple updates' })
  @ApiParam({ name: 'id', description: 'The ID of the ticket to test with' })
  @ApiResponse({ status: 200, description: 'All updates completed successfully', type: Ticket })
  @ApiResponse({ status: 409, description: 'Version conflict detected' })
  @SensitiveRateLimit()
  async testOptimisticConcurrency(
    @Param('id') id: string
  ): Promise<{ message: string; originalVersion: number; finalVersion: number; updates: number }> {
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
}
