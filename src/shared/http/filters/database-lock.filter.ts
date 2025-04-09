import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch(QueryFailedError)
export class DatabaseLockExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isLockTimeoutError = this.isLockTimeoutError(exception);
    const isDeadlockError = this.isDeadlockError(exception);

    if (isLockTimeoutError || isDeadlockError) {
      response.status(HttpStatus.LOCKED).json({
        statusCode: HttpStatus.LOCKED,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: isDeadlockError
          ? 'Deadlock detected. Please try again later.'
          : 'Resource is locked by another operation. Please try again later.',
        error: 'Locked'
      });
    } else {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: 'Internal server error',
        error: 'Internal Server Error'
      });
    }
  }

  private isLockTimeoutError(exception: QueryFailedError): boolean {
    const errorMessage = exception.message.toLowerCase();
    return (
      errorMessage.includes('lock') &&
      (errorMessage.includes('timeout') || errorMessage.includes('wait') || errorMessage.includes('nowait'))
    );
  }

  private isDeadlockError(exception: QueryFailedError): boolean {
    const errorMessage = exception.message.toLowerCase();
    return errorMessage.includes('deadlock');
  }
}
