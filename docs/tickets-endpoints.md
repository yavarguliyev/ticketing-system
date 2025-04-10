# Tickets API Endpoints

## Basic CRUD Operations

- `POST /tickets` - Creates a new ticket with specified details and initial quantity. Requires title, description, price, and quantity in the request body.
- `GET /tickets` - Retrieves all available tickets with pagination support. Supports query parameters for page and limit.
- `GET /tickets/:id` - Fetches a specific ticket by its unique identifier. Returns 404 if ticket not found.
- `PATCH /tickets/:id` - Updates an existing ticket's details. Supports partial updates of title, description, price, and quantity.
- `DELETE /tickets/:id` - Removes a ticket from the system. Returns 404 if ticket not found.

## Pessimistic Locking Operations

- `POST /tickets/:id/book` - Books tickets using pessimistic locking to prevent concurrent modifications. Locks the ticket row during the transaction.
- `POST /tickets/:id/release` - Releases previously booked tickets using pessimistic locking. Ensures atomic release of tickets.

## Availability Checks

- `GET /tickets/:id/availability` - Checks if a specific quantity of tickets is available for booking. Returns boolean indicating availability.

## Optimistic Concurrency Operations

- `POST /tickets/:id/book-optimistic` - Books tickets using optimistic concurrency control with version tracking. Automatically retries on version conflicts.
- `POST /tickets/:id/release-optimistic` - Releases tickets using optimistic concurrency control. Handles concurrent release attempts safely.
- `GET /tickets/:id/availability-optimistic` - Checks availability using optimistic concurrency control. Returns current version along with availability status.

## Transaction Isolation Levels

- `POST /tickets/:id/book-read-uncommitted` - Books tickets using READ UNCOMMITTED isolation level. May read uncommitted changes from other transactions.
- `POST /tickets/:id/book-read-committed` - Books tickets using READ COMMITTED isolation level. Only reads committed data.
- `POST /tickets/:id/book-repeatable-read` - Books tickets using REPEATABLE READ isolation level. Maintains consistent reads within transaction.
- `POST /tickets/:id/book-serializable` - Books tickets using SERIALIZABLE isolation level. Highest isolation level preventing all concurrency anomalies.

## Testing Endpoints

- `GET /tickets/:id/test-optimistic-concurrency` - Tests optimistic concurrency control with multiple concurrent updates. Simulates race conditions and retries.
- `GET /tickets/test-isolation-anomalies` - Tests for various transaction isolation level anomalies. Demonstrates dirty reads, non-repeatable reads, and phantom reads.
- `PATCH /tickets/:id/update-with-retry` - Updates a ticket with built-in retry mechanism for optimistic concurrency. Implements exponential backoff for retries.
