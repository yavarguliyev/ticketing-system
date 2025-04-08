# Ticketing System

A robust ticketing system demonstrating advanced concurrency control mechanisms in NestJS and TypeORM.

## Purpose

This application was built to demonstrate different methods of handling concurrency in a real-world ticket booking scenario, where multiple users might attempt to book the same tickets simultaneously. It provides working implementations of:

- **Pessimistic locking** - Using row-level database locks to prevent concurrent modifications
- **Optimistic concurrency control** - Using version checks to detect and handle conflicts
- **Transaction isolation levels** - Demonstrating the effects of different SQL isolation levels
- **Deadlock prevention and handling** - Strategies to prevent and recover from deadlocks

## Key Features

- **Ticket Management**: Create, read, update, and delete ticket resources
- **Booking System**: Book and release tickets with protection against overselling
- **Concurrency Control**:
  - Pessimistic locking with `SELECT FOR UPDATE` queries
  - Optimistic concurrency with version columns
  - Automatic retry mechanisms for handling conflicts
- **Transaction Management**:
  - Custom transaction decorators
  - Multiple isolation level support
  - Transaction timeouts
- **Error Handling**:
  - Specialized exception filters for database locks
  - Version conflict detection and handling
- **API Rate Limiting**: Protection against API abuse with tiered rate limiting

## Technology Stack

- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Containerization**: Docker and Docker Compose

## Architecture

The application follows a modular architecture with:

- **Modules**: Feature-based organization (tickets, users, etc.)
- **Controllers**: Handle HTTP requests and API endpoints
- **Services**: Implement business logic and database operations
- **Entities**: Define database models and relationships
- **DTOs**: Validate and transfer data between layers
- **Interceptors**: Process requests and responses
- **Filters**: Handle exceptions globally
- **Guards**: Protect routes (rate limiting)
- **Decorators**: Provide custom metadata for transactions and rate limiting

## Concurrency Handling

### Pessimistic Locking

The system implements pessimistic locking for critical operations:

```typescript
const ticket = await ticketRepository.findOne({
  where: { id },
  lock: { mode: 'pessimistic_write', onLocked: 'nowait' }
});
```

Key features include:

- `nowait` option to fail immediately if a row is locked
- Statement timeouts to prevent long-running transactions
- Database exception filters to handle lock timeouts and deadlocks

### Optimistic Concurrency Control

The system provides optimistic locking with:

```typescript
// Version column in entity
@VersionColumn()
version!: number;

// Update with version check
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
```

Features include:

- Automatic version tracking
- Explicit version checking in updates
- Retry mechanisms with exponential backoff and jitter
- Exception handling for version conflicts

### Transaction Isolation Levels

The system demonstrates all standard isolation levels:

- **READ UNCOMMITTED**: Demonstrates dirty reads
- **READ COMMITTED**: Shows non-repeatable reads
- **REPEATABLE READ**: Prevents non-repeatable reads
- **SERIALIZABLE**: Prevents all concurrency phenomena

API endpoints allow testing each isolation level's behavior.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Docker and Docker Compose (optional)

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yavarguliyev/ticketing-system.git
   ```

2. Install dependencies:

   ```
   cd ticketing-system
   npm install
   ```

3. Set up environment variables:

   ```
   cp .env.example .env
   ```

4. Start the database:

   ```
   docker-compose up -d postgres
   ```

5. Run migrations:

   ```
   npm run migration:run
   ```

6. Start the application:

   ```
   npm run start:dev
   ```

7. Access the Swagger documentation at:
   ```
   http://localhost:3000/api
   ```

## Testing Concurrency

### Testing Pessimistic Locking

```bash
# Book a ticket with pessimistic locking
curl -X POST http://localhost:3000/tickets/{id}/book -H "Content-Type: application/json" -d '{"quantity": 1}'

# Try concurrent bookings to see locking in action
for i in {1..5}; do curl -X POST http://localhost:3000/tickets/{id}/book -H "Content-Type: application/json" -d '{"quantity": 1}' & done; wait
```

### Testing Optimistic Concurrency

```bash
# Book a ticket with optimistic concurrency control
curl -X POST http://localhost:3000/tickets/{id}/book-optimistic -H "Content-Type: application/json" -d '{"quantity": 1}'

# Try concurrent bookings to see retry mechanism in action
for i in {1..5}; do curl -X POST http://localhost:3000/tickets/{id}/book-optimistic -H "Content-Type: application/json" -d '{"quantity": 1}' & done; wait
```

### Testing Isolation Levels

```bash
# Test all isolation levels
curl -X POST http://localhost:3000/isolation-levels/test-all/{id}

# Test specific isolation level
curl -X POST http://localhost:3000/isolation-levels/serializable/{id}
```

## Conclusion

This ticketing system demonstrates practical implementations of database concurrency control techniques in a real-world scenario. It shows the trade-offs between different approaches and provides guidance on when to use each method.
