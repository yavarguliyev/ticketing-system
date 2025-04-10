import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Response, Request } from 'express';

@Catch(QueryFailedError, ConflictException)
export class OptimisticLockExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OptimisticLockExceptionFilter.name);

  catch (exception: QueryFailedError | ConflictException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if ((exception instanceof QueryFailedError && this.isVersionConflictError(exception)) || (exception instanceof ConflictException && this.isOptimisticLockMessage(exception))) {
      const errorMessage = exception instanceof QueryFailedError ? this.getReadableErrorMessage(exception) : exception.message;

      this.logger.warn(`Optimistic lock conflict detected: ${errorMessage} on ${request.method} ${request.url}`);

      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: errorMessage || 'Version conflict detected. The resource was modified by another transaction.',
        error: 'Conflict',
        path: request.url,
        timestamp: new Date().toISOString()
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

  private isOptimisticLockMessage (exception: ConflictException): boolean {
    const message = exception.message.toLowerCase();
    return message.includes('version conflict') || message.includes('concurrent') || message.includes('optimistic') || message.includes('modified by another transaction');
  }

  private getReadableErrorMessage (error: QueryFailedError): string {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('version check failed')) {
      return 'The record was modified by another user while you were editing it. Please reload and try again.';
    }

    if (errorMessage.includes('could not serialize access due to concurrent update')) {
      return 'Your changes conflict with changes made by another user. Please reload and try again.';
    }

    if (errorMessage.includes('row was updated or deleted')) {
      return 'This resource no longer exists or has been updated. Please reload to see the current state.';
    }

    return 'A conflict occurred with another concurrent operation. Please try again.';
  }
}
