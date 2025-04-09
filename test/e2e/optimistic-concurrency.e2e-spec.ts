import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { Server } from 'http';

import { AppModule } from '../../src/app.module';
import { Ticket } from '../../src/modules/tickets/entities/ticket.entity';

interface TicketResponse {
  id: string;
  version: number;
  quantity: number;
  message?: string;
}

interface ConcurrentTestResponse {
  message: string;
  originalVersion: number;
  finalVersion: number;
  updates: number;
}

const getHttpServer = (app: INestApplication): Server => app.getHttpServer() as Server;

describe('Optimistic Concurrency (e2e)', () => {
  let app: INestApplication;
  let ticketRepository: Repository<Ticket>;
  let testTicketId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    ticketRepository = moduleFixture.get<Repository<Ticket>>(getRepositoryToken(Ticket));
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create a test ticket', async () => {
    const createTicketResponse = await request(getHttpServer(app))
      .post('/tickets')
      .send({
        title: 'E2E Test Ticket',
        description: 'Ticket for E2E testing optimistic concurrency',
        price: 100,
        quantity: 20
      })
      .expect(201);

    const responseBody = createTicketResponse.body as TicketResponse;
    expect(responseBody).toHaveProperty('id');
    expect(responseBody).toHaveProperty('version');
    expect(responseBody.version).toBe(1);

    testTicketId = responseBody.id;
  });

  it('should successfully book tickets with optimistic concurrency', async () => {
    const response = await request(getHttpServer(app))
      .post(`/tickets/${testTicketId}/book-optimistic`)
      .send({
        quantity: 2,
        userId: 'e2e-test-user'
      })
      .expect(200);

    const responseBody = response.body as TicketResponse;
    expect(responseBody).toHaveProperty('version');
    expect(responseBody.version).toBe(2);
    expect(responseBody.quantity).toBe(18);
  });

  it('should successfully release tickets with optimistic concurrency', async () => {
    const response = await request(getHttpServer(app))
      .post(`/tickets/${testTicketId}/release-optimistic`)
      .send({
        quantity: 1,
        userId: 'e2e-test-user'
      })
      .expect(200);

    const responseBody = response.body as TicketResponse;
    expect(responseBody).toHaveProperty('version');
    expect(responseBody.version).toBe(3);
    expect(responseBody.quantity).toBe(19);
  });

  it('should reject booking when not enough tickets', async () => {
    await request(getHttpServer(app))
      .post(`/tickets/${testTicketId}/book-optimistic`)
      .send({
        quantity: 100,
        userId: 'e2e-test-user'
      })
      .expect(409);
  });

  it('should handle version conflicts during concurrent operations', async () => {
    const ticket = await ticketRepository.findOne({ where: { id: testTicketId } });

    if (!ticket) {
      throw new Error('Test ticket not found');
    }

    const currentVersion = ticket.version;

    await ticketRepository.update({ id: testTicketId }, { version: currentVersion + 1 });

    const response = await request(getHttpServer(app)).post(`/tickets/${testTicketId}/book-optimistic`).send({
      quantity: 1,
      userId: 'e2e-test-user'
    });

    const responseBody = response.body as TicketResponse;
    expect(response.status).toBe(409);
    expect(responseBody.message).toContain('conflict');
  });

  it('should run the concurrent test endpoint successfully', async () => {
    const response = await request(getHttpServer(app)).post(`/tickets/${testTicketId}/concurrent-test`).expect(200);

    const responseBody = response.body as ConcurrentTestResponse;
    expect(responseBody).toHaveProperty('message');
    expect(responseBody).toHaveProperty('originalVersion');
    expect(responseBody).toHaveProperty('finalVersion');
    expect(responseBody).toHaveProperty('updates');

    expect(responseBody.finalVersion > responseBody.originalVersion).toBe(true);
  });
});
