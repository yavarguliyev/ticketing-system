import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { TicketsService } from '../../src/modules/tickets/services/tickets.service';
import { Ticket } from '../../src/modules/tickets/entities/ticket.entity';
import { CreateTicketDto } from '../../src/modules/tickets/dto/create-ticket.dto';
import { UpdateTicketDto } from '../../src/modules/tickets/dto/update-ticket.dto';
import { TransactionService } from '../../src/shared/database/services/transaction.service';
import { OptimisticConcurrencyService } from '../../src/shared/database/services/optimistic-concurrency.service';
import { TransactionCallback } from '../../src/shared/database/services/transaction.service';

type MockType<T> = {
  [P in keyof T]?: jest.Mock<any, any>;
};

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketRepository: MockType<Repository<Ticket>>;
  let transactionService: Partial<TransactionService>;
  let optimisticConcurrencyService: Partial<OptimisticConcurrencyService>;

  const mockTicket: Ticket = {
    id: '00000000-0000-4000-a000-000000000000',
    title: 'Test Ticket',
    description: 'Test Description',
    price: 100,
    quantity: 10,
    userId: '00000000-0000-4000-a000-000000000001',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1
  };

  const mockRepositoryFactory: () => MockType<Repository<any>> = jest.fn(() => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            andWhere: jest.fn(() => ({
              execute: jest.fn()
            }))
          }))
        }))
      }))
    }))
  }));

  beforeEach(async () => {
    ticketRepository = mockRepositoryFactory();
    
    transactionService = {
      execute: jest.fn().mockImplementation(<T>(callback: TransactionCallback<T>) => {
        return Promise.resolve(callback({
          getRepository: () => ticketRepository
        } as unknown as EntityManager));
      })
    };
    
    optimisticConcurrencyService = {
      executeWithRetry: jest.fn().mockImplementation(<T>(operation: () => Promise<T>) => 
        Promise.resolve(operation())
      )
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: getRepositoryToken(Ticket),
          useValue: ticketRepository
        },
        {
          provide: TransactionService,
          useValue: transactionService
        },
        {
          provide: OptimisticConcurrencyService,
          useValue: optimisticConcurrencyService
        }
      ]
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('create', () => {
    it('should create a new ticket', async () => {
      const createTicketDto: CreateTicketDto = {
        title: 'New Ticket',
        description: 'New Description',
        price: 200,
        quantity: 20,
        userId: '00000000-0000-4000-a000-000000000001'
      };

      ticketRepository.create!.mockReturnValue(mockTicket);
      ticketRepository.save!.mockResolvedValue(mockTicket);

      const result = await service.create(createTicketDto);

      expect(ticketRepository.create).toHaveBeenCalledWith(createTicketDto);
      expect(ticketRepository.save).toHaveBeenCalledWith(mockTicket);
      expect(result).toEqual(mockTicket);
    });
  });

  describe('findAll', () => {
    it('should return an array of tickets', async () => {
      ticketRepository.find!.mockResolvedValue([mockTicket]);

      const result = await service.findAll();

      expect(ticketRepository.find).toHaveBeenCalled();
      expect(result).toEqual([mockTicket]);
    });
  });

  describe('findOne', () => {
    it('should return a ticket by id', async () => {
      ticketRepository.findOne!.mockResolvedValue(mockTicket);

      const result = await service.findOne(mockTicket.id);

      expect(ticketRepository.findOne).toHaveBeenCalledWith({ where: { id: mockTicket.id } });
      expect(result).toEqual(mockTicket);
    });

    it('should throw NotFoundException when ticket is not found', async () => {
      ticketRepository.findOne!.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a ticket by id', async () => {
      const updateTicketDto: UpdateTicketDto = {
        title: 'Updated Ticket'
      };

      const updatedTicket = { ...mockTicket, ...updateTicketDto };

      ticketRepository.findOne!.mockResolvedValue(mockTicket);
      ticketRepository.save!.mockResolvedValue(updatedTicket);

      const result = await service.update(mockTicket.id, updateTicketDto);

      expect(ticketRepository.findOne).toHaveBeenCalledWith({ where: { id: mockTicket.id } });
      expect(ticketRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedTicket);
    });

    it('should throw NotFoundException when updating non-existent ticket', async () => {
      ticketRepository.findOne!.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { title: 'New Title' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should remove a ticket by id', async () => {
      ticketRepository.delete!.mockResolvedValue({ affected: 1 });

      await service.remove(mockTicket.id);

      expect(ticketRepository.delete).toHaveBeenCalledWith(mockTicket.id);
    });

    it('should throw NotFoundException when removing non-existent ticket', async () => {
      ticketRepository.delete!.mockResolvedValue({ affected: 0 });

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('bookTicket', () => {
    it('should book a ticket successfully', async () => {
      const ticketBeforeBooking = { ...mockTicket };
      const ticketAfterBooking = { ...mockTicket, quantity: mockTicket.quantity - 2 };
      
      ticketRepository.findOne!.mockResolvedValue(ticketBeforeBooking);
      ticketRepository.save!.mockResolvedValue(ticketAfterBooking);

      const result = await service.bookTicket(mockTicket.id, mockTicket.userId, 2);

      expect(transactionService.execute).toHaveBeenCalled();
      expect(ticketRepository.findOne).toHaveBeenCalled();
      expect(ticketRepository.save).toHaveBeenCalled();
      expect(result).toEqual(ticketAfterBooking);
    });

    it('should throw NotFoundException when booking a non-existent ticket', async () => {
      ticketRepository.findOne!.mockResolvedValue(null);

      await expect(service.bookTicket('non-existent-id', mockTicket.userId, 2)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException when not enough tickets available', async () => {
      ticketRepository.findOne!.mockResolvedValue(mockTicket);

      await expect(service.bookTicket(mockTicket.id, mockTicket.userId, 20)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('checkAvailability', () => {
    it('should return true when tickets are available', async () => {
      ticketRepository.findOne!.mockResolvedValue(mockTicket);

      const result = await service.checkAvailability(mockTicket.id, 5);

      expect(transactionService.execute).toHaveBeenCalled();
      expect(ticketRepository.findOne).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when tickets are not available', async () => {
      ticketRepository.findOne!.mockResolvedValue(mockTicket);

      const result = await service.checkAvailability(mockTicket.id, 15);

      expect(transactionService.execute).toHaveBeenCalled();
      expect(ticketRepository.findOne).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should throw NotFoundException when checking availability for non-existent ticket', async () => {
      ticketRepository.findOne!.mockResolvedValue(null);

      await expect(service.checkAvailability('non-existent-id', 5)).rejects.toThrow(
        NotFoundException
      );
    });
  });
}); 