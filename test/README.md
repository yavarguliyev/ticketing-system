# Test Suite for Ticketing System

This directory contains all the tests for the ticketing system, organized by type.

## Structure

- `e2e/`: End-to-end tests that verify the complete application flow
- `integration/`: Integration tests that verify interaction between components
- `unit/`: Unit tests for individual components
- `jest-e2e.json`: Configuration for Jest e2e tests

## Test Types

### Unit Tests

Unit tests focus on testing individual components in isolation. They verify that each component correctly implements its specified behavior without relying on external dependencies.

Example: Testing the `OptimisticConcurrencyService` to ensure it correctly handles retries and error conditions.

### Integration Tests

Integration tests verify that different components work together correctly. These tests interact with multiple components but may mock external dependencies like the database.

Example: The `concurrency-comparison.spec.ts` test which compares optimistic and pessimistic concurrency approaches.

### End-to-End Tests

End-to-end tests verify the entire application stack, including API endpoints, database interactions, and business logic. These tests provide confidence that the system works correctly as a whole.

Example: The `optimistic-concurrency.e2e-spec.ts` test which verifies that optimistic concurrency control works correctly through API calls.

## Running Tests

- Unit tests: `npm run test`
- E2E tests: `npm run test:e2e`
- All tests with coverage: `npm run test:cov`

## Concurrency Control Tests

The test suite includes specific tests for both optimistic and pessimistic concurrency control:

1. `unit/optimistic-concurrency.service.spec.ts` - Tests the retry mechanism and error handling in isolation
2. `integration/optimistic-concurrency.spec.ts` - Tests the optimistic concurrency approach via direct API calls
3. `integration/concurrency-comparison.spec.ts` - Compares performance and behavior between optimistic and pessimistic approaches
4. `e2e/optimistic-concurrency.e2e-spec.ts` - Tests the optimistic concurrency implementation through the full application stack

These tests demonstrate how the system handles concurrent operations and prevents data corruption or race conditions when multiple users interact with the same resources simultaneously.

# Optimistic Concurrency Control Tests

This directory contains tests to demonstrate optimistic concurrency control in the ticketing system.

## Optimistic Concurrency Test

The `optimistic-concurrency-test.js` script demonstrates optimistic concurrency control by sending multiple concurrent requests to update a ticket and showing how version tracking works.

### Prerequisites

- The ticketing system API must be running (`npm run start:dev` from the ticketing-system directory)
- A ticket must exist in the system

### Running the Test

```bash
# From the ticketing-system directory
npm run test:optimistic <ticket-id>
```

Replace `<ticket-id>` with the ID of an existing ticket in your system.

### What the Test Does

This test demonstrates optimistic concurrency control in the following ways:

1. **Standard Updates Without Retry**

   - Sends multiple concurrent requests to update the ticket price
   - Some updates will succeed, others will fail with version conflicts
   - Shows how version numbers increment with successful updates

2. **Updates With Automatic Retry**

   - Uses the `/tickets/:id/with-retry` endpoint which implements retry logic
   - Demonstrates higher success rate despite concurrent modifications
   - Shows version number increments

3. **Concurrent Booking Operations**

   - Tests the booking functionality with optimistic concurrency
   - Demonstrates how booking and releasing tickets work with versioning
   - Shows conflicts when tickets become unavailable

4. **Built-in Concurrent Test Endpoint**
   - Tests the application's own concurrent test endpoint
   - Shows version changes from the server's perspective

### Understanding the Results

- **Success vs. Failure rates**: Compare the success rates between standard updates and updates with retry
- **Version increments**: Each successful update increments the version number
- **Status codes**: Failed updates typically show 409 Conflict status for version mismatches

## Interpreting Version Conflicts

When you see version conflicts in the test results, this is actually a good sign! It means:

1. The optimistic concurrency control is working as expected
2. The system detected that the same resource was modified by another transaction
3. Without this protection, data could be lost due to the "last write wins" problem

## Tips for Managing Concurrency

Based on these tests, you can see different approaches to handling concurrency:

1. **Client-side retries**: The retry mechanism can help applications automatically recover from conflicts
2. **Read-then-write pattern**: Always fetch the latest version before updating
3. **Conflict resolution UIs**: In real applications, you might want to show users conflicts and let them resolve them

## Further Testing

You can modify this test script to experiment with different aspects of optimistic concurrency:

- Change the number of concurrent requests (CONCURRENT_REQUESTS variable)
- Modify the delay between retries in the system
- Test different types of operations (create, update, delete)
