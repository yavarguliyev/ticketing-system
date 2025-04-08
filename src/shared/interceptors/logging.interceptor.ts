import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request } from 'express';

interface HttpRequest {
  method: string;
  url: string;
  ip: string;
  body: unknown;
  query: unknown;
  params: unknown;
}

interface HttpResponse {
  statusCode: number;
}

interface RequestData {
  method: string;
  url: string;
  ip: string;
  body: unknown;
  query: unknown;
  params: unknown;
  timestamp: number;
  traceId: string;
}

interface ResponseData {
  method: string;
  url: string;
  ip: string;
  responseTime: number;
  status?: number;
  error?: string;
  traceId: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger = new Logger(LoggingInterceptor.name);

  intercept (context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method || 'UNKNOWN';
    const url = request.url || 'UNKNOWN';
    const ip = request.ip || 'UNKNOWN';
    const body = request.body;
    const query = request.query;
    const params = request.params;
    const timestamp: number = new Date().getTime();
    const traceId: string = randomUUID();

    (request as any).traceId = traceId;

    const requestContext: RequestData = {
      method,
      url,
      ip,
      body,
      query,
      params,
      timestamp,
      traceId
    };

    this.logger.log(`Request [${traceId}]: ${method} ${url}`, { context: requestContext });

    return next.handle().pipe(
      tap({
        next: (data: unknown) => {
          const response = context.switchToHttp().getResponse<HttpResponse>();
          const responseTime = new Date().getTime() - timestamp;
          
          const responseContext: ResponseData = {
            method,
            url,
            ip,
            responseTime,
            status: response.statusCode,
            traceId
          };

          this.logger.log(`Response [${traceId}]: ${method} ${url} - ${responseTime}ms`, { context: responseContext });
        },
        error: (error: Error) => {
          const responseTime = new Date().getTime() - timestamp;
          
          const responseContext: ResponseData = {
            method,
            url,
            ip,
            responseTime,
            error: error.message,
            traceId
          };

          this.logger.error(`Error [${traceId}]: ${method} ${url} - ${responseTime}ms`, { context: responseContext, error });
        }
      })
    );
  }
}
