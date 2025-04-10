import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';
import { Server } from 'http';

import { AppModule } from '../../src/app.module';
import { Ticket } from '../../src/modules/tickets/entities/ticket.entity';
import { CreateTicketDto } from '../../src/modules/tickets/dto/create-ticket.dto';
import { UpdateTicketDto } from '../../src/modules/tickets/dto/update-ticket.dto';

interface TicketResponse {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  userId: string;
  version: number;
}

const getHttpServer = (app: INestApplication): Server => {
  const httpAdapter = app.getHttpAdapter();
  return httpAdapter.getInstance() as Server;
};

describe('Tickets CRUD Operations (e2e)', () => {
  let app: INestApplication;
  let ticketRepository: Repository<Ticket>;
  let createdTicketId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    ticketRepository = moduleFixture.get<Repository<Ticket>>(getRepositoryToken(Ticket));

    await ticketRepository.delete({ title: 'E2E Test Ticket' });
  });

  afterAll(async () => {
    if (createdTicketId) {
      await ticketRepository.delete(createdTicketId);
    }
    await app.close();
  });

  describe('POST /tickets', () => {
    it('should create a new ticket', async () => {
      const createTicketDto: CreateTicketDto = {
        title: 'E2E Test Ticket',
        description: 'Ticket for E2E testing CRUD operations',
        price: 150,
        quantity: 25,
        userId: '00000000-0000-4000-a000-000000000000'
      };

      const response = await request(getHttpServer(app)).post('/tickets').send(createTicketDto).expect(201);

      const ticket = response.body as TicketResponse;

      expect(ticket).toHaveProperty('id');
      expect(ticket.title).toBe(createTicketDto.title);
      expect(ticket.description).toBe(createTicketDto.description);
      expect(Number(ticket.price)).toBe(createTicketDto.price);
      expect(ticket.quantity).toBe(createTicketDto.quantity);
      expect(ticket.userId).toBe(createTicketDto.userId);
      expect(ticket.version).toBe(1);

      createdTicketId = ticket.id;
    });

    it('should return 400 when creating a ticket with invalid data', async () => {
      const invalidTicket = {
        title: '',
        description: 'Invalid ticket',
        price: -10,
        quantity: -5
      };

      const response = await request(getHttpServer(app)).post('/tickets').send(invalidTicket).expect(400);

      const responseBody = response.body as TicketResponse & { message: string };

      expect(responseBody).toHaveProperty('message');
      expect(Array.isArray(responseBody.message)).toBe(true);
    });
  });

  describe('GET /tickets', () => {
    it('should return all tickets', async () => {
      const response = await request(getHttpServer(app)).get('/tickets').expect(200);

      const responseBody = response.body as TicketResponse[];

      expect(Array.isArray(responseBody)).toBe(true);
      expect(responseBody.length).toBeGreaterThan(0);

      const createdTicket = responseBody.find((ticket) => ticket.id === createdTicketId);

      expect(createdTicket).toBeDefined();
      expect(createdTicket?.title).toBe('E2E Test Ticket');
    });
  });

  describe('GET /tickets/:id', () => {
    it('should return a ticket by ID', async () => {
      const response = await request(getHttpServer(app)).get(`/tickets/${createdTicketId}`).expect(200);

      const ticket = response.body as TicketResponse;

      expect(ticket.id).toBe(createdTicketId);
      expect(ticket.title).toBe('E2E Test Ticket');
    });

    it('should return 404 for non-existent ticket ID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(getHttpServer(app)).get(`/tickets/${nonExistentId}`).expect(404);
    });
  });

  describe('PATCH /tickets/:id', () => {
    it('should update a ticket by ID', async () => {
      const updateTicketDto: UpdateTicketDto = {
        title: 'Updated E2E Test Ticket',
        description: 'Updated description for E2E testing',
        price: 200
      };

      const response = await request(getHttpServer(app))
        .patch(`/tickets/${createdTicketId}`)
        .send(updateTicketDto)
        .expect(200);

      const updatedTicket = response.body as TicketResponse;

      expect(updatedTicket.id).toBe(createdTicketId);
      expect(updatedTicket.title).toBe(updateTicketDto.title);
      expect(updatedTicket.description).toBe(updateTicketDto.description);
      expect(Number(updatedTicket.price)).toBe(updateTicketDto.price);
      expect(updatedTicket.version).toBe(2);
    });

    it('should return 404 when updating a non-existent ticket', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const updateTicketDto: UpdateTicketDto = {
        title: 'This Update Should Fail'
      };

      await request(getHttpServer(app)).patch(`/tickets/${nonExistentId}`).send(updateTicketDto).expect(404);
    });
  });

  describe('DELETE /tickets/:id', () => {
    it('should return 404 when deleting a non-existent ticket', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(getHttpServer(app)).delete(`/tickets/${nonExistentId}`).expect(404);
    });

    it('should delete a ticket by ID', async () => {
      await request(getHttpServer(app)).delete(`/tickets/${createdTicketId}`).expect(200);

      await request(getHttpServer(app)).get(`/tickets/${createdTicketId}`).expect(404);

      createdTicketId = '';
    });
  });
});
