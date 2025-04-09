import { Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsolationLevelService, IsolationTestResult } from '../../database/services/isolation-level.service';
import { MediumRateLimit } from '../decorators/throttle.decorator';

@ApiTags('isolation-levels')
@Controller('isolation-levels')
export class IsolationLevelController {
  constructor (private readonly isolationLevelService: IsolationLevelService) {}

  @ApiOperation({ summary: 'Test READ UNCOMMITTED isolation level (Dirty Read)' })
  @ApiParam({ name: 'ticketId', description: 'The ID of the ticket to use for testing' })
  @ApiResponse({
    status: 200,
    description: 'Test results for READ UNCOMMITTED isolation level',
    type: Object
  })
  @MediumRateLimit()
  @Post('read-uncommitted/:ticketId')
  async testReadUncommitted (@Param('ticketId') ticketId: string): Promise<IsolationTestResult> {
    return this.isolationLevelService.testReadUncommitted(ticketId);
  }

  @ApiOperation({ summary: 'Test READ COMMITTED isolation level (Non-Repeatable Read)' })
  @ApiParam({ name: 'ticketId', description: 'The ID of the ticket to use for testing' })
  @ApiResponse({
    status: 200,
    description: 'Test results for READ COMMITTED isolation level',
    type: Object
  })
  @MediumRateLimit()
  @Post('read-committed/:ticketId')
  async testReadCommitted (@Param('ticketId') ticketId: string): Promise<IsolationTestResult> {
    return this.isolationLevelService.testReadCommitted(ticketId);
  }

  @ApiOperation({ summary: 'Test REPEATABLE READ isolation level' })
  @ApiParam({ name: 'ticketId', description: 'The ID of the ticket to use for testing' })
  @ApiResponse({
    status: 200,
    description: 'Test results for REPEATABLE READ isolation level',
    type: Object
  })
  @MediumRateLimit()
  @Post('repeatable-read/:ticketId')
  async testRepeatableRead (@Param('ticketId') ticketId: string): Promise<IsolationTestResult> {
    return this.isolationLevelService.testRepeatableRead(ticketId);
  }

  @ApiOperation({ summary: 'Test SERIALIZABLE isolation level' })
  @ApiParam({ name: 'ticketId', description: 'The ID of the ticket to use for testing' })
  @ApiResponse({
    status: 200,
    description: 'Test results for SERIALIZABLE isolation level',
    type: Object
  })
  @MediumRateLimit()
  @Post('serializable/:ticketId')
  async testSerializable (@Param('ticketId') ticketId: string): Promise<IsolationTestResult> {
    return this.isolationLevelService.testSerializable(ticketId);
  }

  @ApiOperation({ summary: 'Test all isolation levels sequentially' })
  @ApiParam({ name: 'ticketId', description: 'The ID of the ticket to use for testing' })
  @ApiResponse({
    status: 200,
    description: 'Test results for all isolation levels',
    type: Object
  })
  @MediumRateLimit()
  @Post('test-all/:ticketId')
  async testAllIsolationLevels (@Param('ticketId') ticketId: string): Promise<IsolationTestResult[]> {
    const readUncommitted = await this.isolationLevelService.testReadUncommitted(ticketId);
    const readCommitted = await this.isolationLevelService.testReadCommitted(ticketId);
    const repeatableRead = await this.isolationLevelService.testRepeatableRead(ticketId);
    const serializable = await this.isolationLevelService.testSerializable(ticketId);

    return [readUncommitted, readCommitted, repeatableRead, serializable];
  }
}
