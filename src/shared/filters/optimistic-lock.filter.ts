import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class OptimisticLockExceptionFilter implements ExceptionFilter {
  catch (exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    if (this.isVersionConflictError(exception)) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'Version conflict detected. The resource was modified by another transaction.',
        error: 'Conflict',
      });
    } else {
      throw exception;
    }
  }

  private isVersionConflictError (error: QueryFailedError): boolean {
    const errorMessage = error.message.toLowerCase();
    
    return (
      errorMessage.includes('could not serialize access due to concurrent update') ||
      errorMessage.includes('version check failed') ||
      errorMessage.includes('optimistic lock') ||
      errorMessage.includes('row was updated or deleted by another transaction')
    );
  }
} 