# Optimistic Concurrency Control in the Ticketing System

## Overview

Optimistic concurrency control (OCC) is a concurrency control method that assumes conflicts between concurrent operations are rare. Unlike pessimistic locking which locks resources ahead of time, optimistic concurrency allows multiple operations to proceed without locking, and then checks at the time of update whether any conflicts occurred.

## Implementation in Our System

### Version Tracking

The core of our optimistic concurrency implementation is TypeORM's `@VersionColumn()` decorator:

```typescript
@VersionColumn()
version!: number;
```

This automatically increments the version number each time a record is updated. When updating a record, we track the version number and ensure updates only succeed if the version hasn't changed.

### Update Process

1. **Read the entity**: When a client tries to update an entity, the system first reads the current state, including the version number.

2. **Perform changes**: The client makes changes to the entity.

3. **Check version and update**: When saving, we explicitly check the version hasn't changed:

```typescript
const updateResult = await ticketRepository
  .createQueryBuilder()
  .update(Ticket)
  .set({ 
    quantity: ticket.quantity
  })
  .where('id = :id', { id })
  .andWhere('version = :version', { version: initialVersion })
  .execute();

if (updateResult.affected === 0) {
  throw new ConflictException('Version conflict detected.');
}
```

### Retry Mechanism

To handle concurrent operations gracefully, we implemented a retry mechanism with exponential backoff:

```typescript
async executeWithRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context: string = 'operation'
): Promise<T> {
  const retryOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let currentRetry = 0;
  let delay = retryOptions.initialDelay;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (this.isOptimisticLockError(error) && currentRetry < retryOptions.maxRetries) {
        currentRetry++;
        await this.delay(delay);
        
        // Exponential backoff with jitter
        delay = Math.min(
          delay * retryOptions.backoffFactor * (1 + 0.2 * Math.random()), 
          retryOptions.maxDelay
        );
      } else if (this.isOptimisticLockError(error)) {
        throw new ConflictException(`Failed after ${retryOptions.maxRetries} retries`);
      } else {
        throw error;
      }
    }
  }
}
```

### Error Handling

We handle version conflicts using a global exception filter:

```typescript
@Catch(QueryFailedError, ConflictException)
export class OptimisticLockExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError | ConflictException, host: ArgumentsHost): void {
    // Check if this is a version conflict
    if (this.isVersionConflictError(exception)) {
      // Return a 409 Conflict response
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Version conflict detected',
        error: 'Conflict'
      });
    } else {
      throw exception;
    }
  }
}
```

## Optimistic vs. Pessimistic Locking

| Feature | Optimistic Locking | Pessimistic Locking |
|---------|-------------------|---------------------|
| Locks | No explicit locks | Explicit row/table locks |
| Performance | Higher throughput for low-conflict scenarios | Lower throughput due to lock overhead |
| Deadlocks | No deadlocks | Possible deadlocks requiring timeout configuration |
| User Experience | May require retries visible to users | May result in waiting/blocked requests |
| Database Load | Lower lock management overhead | Higher lock management overhead |
| Use Cases | Read-heavy systems, low-conflict rate | Write-heavy systems, high-conflict rate |

## When to Use

Optimistic locking is ideal for our ticketing system because:

1. **Most operations don't conflict**: The majority of ticket views and purchases don't conflict
2. **Better scalability**: No need to hold locks during user thinking time
3. **Resilience**: No risk of orphaned locks if a service crashes

However, for high-contention scenarios like flash sales or extremely popular events, pessimistic locking may still be appropriate.

## Testing Optimistic Concurrency

We've implemented a test endpoint `/tickets/:id/concurrent-test` that:

1. Reads the current state of a ticket
2. Launches multiple concurrent update operations
3. Reports on successful operations and version increments

This allows developers to observe optimistic concurrency in action and measure the effectiveness of our retry mechanism.

## Best Practices

1. **Always include version checking** in update operations
2. **Use retry mechanisms** with exponential backoff and jitter
3. **Provide clear error messages** to clients about version conflicts
4. **Consider business impact** of failed concurrent operations
5. **Monitor version conflicts** to identify high-contention resources 