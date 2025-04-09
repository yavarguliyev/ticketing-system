# Transaction Isolation Levels in Ticketing System

Transaction isolation determines how and when changes made by one transaction become visible to other transactions. This is crucial for maintaining data consistency in concurrent operations.

## Isolation Levels Supported

TypeORM with PostgreSQL supports four standard isolation levels:

| Isolation Level  | Dirty Read | Non-repeatable Read | Phantom Read |
| ---------------- | ---------- | ------------------- | ------------ |
| READ UNCOMMITTED | Possible   | Possible            | Possible     |
| READ COMMITTED   | Prevented  | Possible            | Possible     |
| REPEATABLE READ  | Prevented  | Prevented           | Possible     |
| SERIALIZABLE     | Prevented  | Prevented           | Prevented    |

## Implementation in Our System

In our ticketing system, isolation levels are configured via the TransactionService:

```typescript
async execute<T>(
  callback: TransactionCallback<T>,
  isolationLevel: IsolationLevel = 'READ COMMITTED',
  timeoutMs: number = 5000,
): Promise<T> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction(isolationLevel);

  try {
    // Set statement timeout
    await queryRunner.query(`SET statement_timeout = ${timeoutMs}`);

    const result = await callback(queryRunner.manager);
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

## Isolation Level Use Cases

### READ UNCOMMITTED

The lowest isolation level, allowing a transaction to read data written but not yet committed by other transactions.

**Use case:** Fast read operations where some data inconsistency is acceptable, like non-critical analytics.

**In ticketing:** Not used due to potential for dirty reads.

### READ COMMITTED

Ensures a transaction only reads data that has been committed. However, if another transaction commits changes during the current transaction, subsequent reads might return different results.

**Use case:** General-purpose transactions, balancing performance and consistency.

**In ticketing:** Used for optimistic concurrency operations and non-critical reads.

```typescript
return this.transactionService.execute(async (entityManager) => {
  // Transaction logic
}, 'READ COMMITTED');
```

### REPEATABLE READ

Ensures that any data read during a transaction will remain the same if read again, even if other transactions modify the data and commit.

**Use case:** Reports and analytics that need consistent snapshot-based data.

**In ticketing:** Used for availability checks to ensure consistent results throughout a booking process.

```typescript
return this.transactionService.execute(async (entityManager) => {
  // Check availability logic
}, 'REPEATABLE READ');
```

### SERIALIZABLE

The highest isolation level, preventing all concurrency anomalies but with the highest performance cost.

**Use case:** Financial transactions, critical operations where consistency is paramount.

**In ticketing:** Used for booking/releasing tickets to prevent overselling and ensure strict consistency.

```typescript
return this.transactionService.execute(async (entityManager) => {
  // Ticket booking logic
}, 'SERIALIZABLE');
```

## Performance and Scalability Trade-offs

Higher isolation levels provide stronger consistency guarantees but introduce performance and scalability challenges:

| Isolation Level  | Consistency | Performance | Concurrency | Deadlock Risk |
| ---------------- | ----------- | ----------- | ----------- | ------------- |
| READ UNCOMMITTED | Low         | Highest     | Highest     | Lowest        |
| READ COMMITTED   | Medium      | High        | High        | Low           |
| REPEATABLE READ  | High        | Medium      | Medium      | Medium        |
| SERIALIZABLE     | Highest     | Lowest      | Lowest      | Highest       |

## Concurrency Anomalies

### Dirty Reads (Prevented by READ COMMITTED+)

When a transaction reads data written by another uncommitted transaction.

**Example:** Transaction A reads a ticket quantity that Transaction B has decreased but not committed. If Transaction B rolls back, Transaction A has read invalid data.

### Non-repeatable Reads (Prevented by REPEATABLE READ+)

When a transaction reads the same row twice and gets different values.

**Example:** Transaction A reads a ticket quantity as 10. Transaction B updates it to 8 and commits. Transaction A reads again and sees 8, creating inconsistency within Transaction A.

### Phantom Reads (Prevented by SERIALIZABLE)

When a transaction re-executes a query returning a set of rows that satisfy a condition and finds rows added/removed by recently committed transactions.

**Example:** Transaction A queries tickets with price < $100 and gets 5 results. Transaction B adds a new $50 ticket and commits. Transaction A runs the same query again and gets 6 results.

## Best Practices

1. Use the appropriate isolation level for each operation:

   - READ COMMITTED for general operations
   - REPEATABLE READ for consistent reads
   - SERIALIZABLE for critical booking operations

2. Set explicit timeouts on transactions to prevent long-running transactions

3. Monitor lock contention and transaction throughput

4. Consider using optimistic concurrency for read-heavy operations

5. Keep transactions as short as possible, especially at higher isolation levels
