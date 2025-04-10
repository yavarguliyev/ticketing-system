import { applyDecorators, Post, Get, Patch, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Type } from '@nestjs/common/interfaces';

import { LowRateLimit, MediumRateLimit, SensitiveRateLimit, SkipThrottle } from './throttle.decorator';

interface ApiEndpointOptions {
  summary: string;
  method: 'POST' | 'GET' | 'PATCH' | 'DELETE';
  path?: string;
  statusCode?: number;
  responses?: Array<{
    status: number;
    description: string;
    type?: Type<unknown> | (new (...args: unknown[]) => unknown) | ((...args: unknown[]) => unknown);
    isArray?: boolean;
  }>;
  rateLimit?: 'LOW' | 'MEDIUM' | 'SENSITIVE' | 'NONE';
  extraDecorators?: Array<ClassDecorator | MethodDecorator | PropertyDecorator>;
}

function getDefaultStatusCode(method: string): number {
  switch (method) {
    case 'POST':
      return HttpStatus.CREATED;
    case 'DELETE':
      return HttpStatus.NO_CONTENT;
    default:
      return HttpStatus.OK;
  }
}

function getDefaultDescription(method: string, statusCode: HttpStatus): string {
  switch (statusCode) {
    case HttpStatus.OK:
      return 'The request has succeeded.';
    case HttpStatus.CREATED:
      return 'The resource has been created successfully.';
    case HttpStatus.NO_CONTENT:
      return 'The request has been fulfilled and resource has been deleted.';
    default:
      return 'Operation successful.';
  }
}

export function ApiEndpoint(options: ApiEndpointOptions) {
  const { summary, method, path = '', statusCode = getDefaultStatusCode(method), responses = [], rateLimit = 'MEDIUM', extraDecorators = [] } = options;

  const apiOperation = ApiOperation({ summary });

  const apiResponses = responses.map((response) => {
    const { status, description, type, isArray } = response;
    return ApiResponse({
      status,
      description,
      type,
      isArray
    });
  });

  if (!responses.some((r) => r.status === statusCode)) {
    apiResponses.push(
      ApiResponse({
        status: statusCode,
        description: getDefaultDescription(method, statusCode)
      })
    );
  }

  let rateLimitDecorator;
  switch (rateLimit) {
    case 'LOW':
      rateLimitDecorator = LowRateLimit();
      break;
    case 'MEDIUM':
      rateLimitDecorator = MediumRateLimit();
      break;
    case 'SENSITIVE':
      rateLimitDecorator = SensitiveRateLimit();
      break;
    case 'NONE':
      rateLimitDecorator = SkipThrottle();
      break;
    default:
      rateLimitDecorator = MediumRateLimit();
  }

  let methodDecorator;
  switch (method) {
    case 'GET':
      methodDecorator = Get(path);
      break;
    case 'POST':
      methodDecorator = Post(path);
      break;
    case 'PATCH':
      methodDecorator = Patch(path);
      break;
    case 'DELETE':
      methodDecorator = Delete(path);
      break;
    default:
      methodDecorator = Get(path);
  }

  return applyDecorators(apiOperation, ...apiResponses, rateLimitDecorator, methodDecorator, HttpCode(statusCode), ...extraDecorators);
}

export function ApiCreateEndpoint<T>(options: Omit<ApiEndpointOptions, 'method'> & { type: Type<T> }) {
  const { type, responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'POST',
    responses: [{ status: 201, description: 'The resource has been successfully created.', type }, { status: 400, description: 'Invalid input data.' }, ...responses],
    rateLimit: 'LOW',
    ...rest
  });
}

export function ApiGetAllEndpoint<T>(options: Omit<ApiEndpointOptions, 'method'> & { type: Type<T> }) {
  const { type, responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'GET',
    responses: [{ status: 200, description: 'Resources have been successfully retrieved.', type, isArray: true }, ...responses],
    rateLimit: 'MEDIUM',
    ...rest
  });
}

export function ApiGetOneEndpoint<T>(options: Omit<ApiEndpointOptions, 'method'> & { type: Type<T> }) {
  const { type, responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'GET',
    responses: [{ status: 200, description: 'The resource has been successfully retrieved.', type }, { status: 404, description: 'Resource not found.' }, ...responses],
    rateLimit: 'MEDIUM',
    ...rest
  });
}

export function ApiUpdateEndpoint<T>(options: Omit<ApiEndpointOptions, 'method'> & { type: Type<T> }) {
  const { type, responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'PATCH',
    responses: [
      { status: 200, description: 'The resource has been successfully updated.', type },
      { status: 404, description: 'Resource not found.' },
      { status: 400, description: 'Invalid input data.' },
      ...responses
    ],
    rateLimit: 'SENSITIVE',
    ...rest
  });
}

export function ApiDeleteEndpoint(options: Omit<ApiEndpointOptions, 'method'>) {
  const { responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'DELETE',
    statusCode: HttpStatus.NO_CONTENT,
    responses: [{ status: 204, description: 'The resource has been successfully deleted.' }, { status: 404, description: 'Resource not found.' }, ...responses],
    rateLimit: 'SENSITIVE',
    ...rest
  });
}

export function ApiBookTicketEndpoint<T>(options: Omit<ApiEndpointOptions, 'method'> & { type: Type<T> }) {
  const { type, responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'POST',
    responses: [
      { status: 200, description: 'Tickets successfully booked.', type },
      { status: 404, description: 'Ticket not found.' },
      { status: 409, description: 'Not enough tickets available.' },
      { status: 423, description: 'Resource is locked by another transaction.' },
      ...responses
    ],
    rateLimit: 'SENSITIVE',
    ...rest
  });
}

export function ApiCheckAvailabilityEndpoint(options: Omit<ApiEndpointOptions, 'method'>) {
  const { responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'GET',
    responses: [{ status: 200, description: 'Returns true if tickets are available, false otherwise.' }, { status: 404, description: 'Ticket not found.' }, ...responses],
    rateLimit: 'MEDIUM',
    ...rest
  });
}

export function ApiOptimisticBookTicketEndpoint<T>(options: Omit<ApiEndpointOptions, 'method'> & { type: Type<T> }) {
  const { type, responses = [], ...rest } = options;

  return ApiEndpoint({
    method: 'POST',
    responses: [
      { status: 200, description: 'Tickets successfully booked with optimistic concurrency.', type },
      { status: 404, description: 'Ticket not found.' },
      { status: 409, description: 'Not enough tickets available or version conflict detected.' },
      { status: 500, description: 'Failed to book tickets after retries.' },
      ...responses
    ],
    rateLimit: 'SENSITIVE',
    ...rest
  });
}
