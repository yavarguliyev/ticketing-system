# Transaction Management in the Ticketing System

This document describes how to use the transaction management features in the Ticketing System.

## Overview

The Ticketing System provides a robust transaction management system with the following features:

- Transaction decorators for different isolation levels
- Configurable transaction timeouts
- Automatic deadlock detection and retry mechanisms
- Custom rollback strategies
- Comprehensive error handling

## Using Transaction Decorators

### Basic Usage

The simplest way to use transactions is with the `@Transaction()` decorator:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { Transaction } from '../shared/http/decorators/transaction.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Transaction() // Uses READ COMMITTED by default
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }
}
```

### Specifying Isolation Level

You can specify the isolation level directly:

```typescript
@Post('transfer')
@Transaction({
  isolationLevel: 'SERIALIZABLE',
  timeout: 10000, // 10 seconds timeout
  retryOnDeadlock: true,
  maxRetries: 3
})
async transferFunds(@Body() transferDto: TransferDto) {
  return this.fundService.transfer(transferDto);
}
```

### Using Predefined Decorators

For common isolation levels, you can use predefined decorators:

```typescript
@Get()
@ReadCommittedTransaction()
async findAll() {
  return this.userService.findAll();
}

@Post('important-operation')
@SerializableTransaction({
  timeout: 20000, // 20 seconds timeout
  maxRetries: 5
})
async importantOperation(@Body() operationDto: OperationDto) {
  return this.operationService.execute(operationDto);
}

@Get('products')
@RepeatableReadTransaction()
async getAllProducts() {
  return this.productService.findAll();
}
```

## How It Works

When you apply a transaction decorator to a controller method:

1. The `TransactionInterceptor` intercepts the request.
2. The interceptor starts a transaction with the specified isolation level.
3. The method is executed within this transaction.
4. If the method completes successfully, the transaction is committed.
5. If an error occurs, the transaction is rolled back.

## Using the TransactionService Directly

For more complex scenarios, you can inject and use the `TransactionService` directly:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../shared/database/services/transaction.service';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly transactionService: TransactionService
  ) {}

  async createWithRelatedEntities(createUserDto: CreateUserDto) {
    return this.transactionService.withSerializableTransaction(async (entityManager) => {
      // Access repositories through entityManager
      const userRepository = entityManager.getRepository(User);
      
      // Perform operations
      const user = userRepository.create(createUserDto);
      await userRepository.save(user);
      
      // Return result
      return user;
    });
  }
}
```

## Helper Methods

The TransactionService provides the following helper methods:

- `withTransaction(callback, isolationLevel, options)` - Execute in a transaction with the specified isolation level
- `withSerializableTransaction(callback, options)` - Execute in a SERIALIZABLE transaction
- `withRepeatableReadTransaction(callback, options)` - Execute in a REPEATABLE READ transaction
- `withReadCommittedTransaction(callback, options)` - Execute in a READ COMMITTED transaction

## Isolation Levels

The system supports the following isolation levels:

- **READ COMMITTED** (default): Prevents dirty reads, but allows non-repeatable reads and phantom reads
- **REPEATABLE READ**: Prevents dirty reads and non-repeatable reads, but allows phantom reads
- **SERIALIZABLE**: Prevents all concurrency problems (dirty reads, non-repeatable reads, phantom reads)

## Transaction Options

The transaction system supports the following options:

- `isolationLevel`: The transaction isolation level
- `timeout`: The transaction timeout in milliseconds
- `statementTimeout`: The statement timeout in milliseconds
- `retryOnDeadlock`: Whether to retry on deadlock (default: true)
- `maxRetries`: The maximum number of retries (default: 3)
- `retryDelay`: The delay between retries in milliseconds (default: 200)

## Rollback Strategies

The system includes a `RollbackStrategyService` that handles different types of database errors:

- Deadlock errors (automatically retried)
- Serialization errors (automatically retried)
- Lock timeout errors (not retried by default)
- Statement timeout errors (not retried by default)

You can register custom rollback strategies if needed:

```typescript
import { Injectable } from '@nestjs/common';
import { RollbackStrategyService } from '../shared/database/services/rollback-strategy.service';

@Injectable()
export class CustomRollbackService {
  constructor(private readonly rollbackStrategyService: RollbackStrategyService) {
    // Register a custom strategy
    this.rollbackStrategyService.registerStrategy({
      shouldRollback: (error) => {
        // Custom logic to decide if this strategy should handle the error
        return error instanceof CustomError;
      },
      onRollback: (error) => {
        // Custom logic to execute after rollback
        console.log('Custom error handled', error);
      },
      retryable: true // Whether this error should be retried
    });
  }
}
``` 