import { API_ERROR_CODES, type ApiErrorCode } from '@remoranotes/shared';

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error factories
export const errors = {
  unauthorized: (message = 'Authentication required') =>
    new AppError(API_ERROR_CODES.UNAUTHORIZED, message, 401),

  forbidden: (message = 'Access denied') => new AppError(API_ERROR_CODES.FORBIDDEN, message, 403),

  notFound: (resource = 'Resource') =>
    new AppError(API_ERROR_CODES.NOT_FOUND, `${resource} not found`, 404),

  conflict: (message: string) => new AppError(API_ERROR_CODES.CONFLICT, message, 409),

  alreadyExists: (resource = 'Resource') =>
    new AppError(API_ERROR_CODES.ALREADY_EXISTS, `${resource} already exists`, 409),

  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError(API_ERROR_CODES.VALIDATION_ERROR, message, 400, details),

  planLimitReached: (limit: string) =>
    new AppError(API_ERROR_CODES.PLAN_LIMIT_REACHED, `Plan limit reached: ${limit}`, 403),

  rateLimitExceeded: () =>
    new AppError(API_ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', 429),

  scopeRequired: (scope: string) =>
    new AppError(
      API_ERROR_CODES.SCOPE_REQUIRED,
      `This action requires the "${scope}" permission. Please grant access in settings.`,
      403,
      { requiredScope: scope }
    ),

  googleApiError: (message: string, details?: Record<string, unknown>) =>
    new AppError(API_ERROR_CODES.GOOGLE_API_ERROR, message, 502, details),

  internal: (message = 'Internal server error') =>
    new AppError(API_ERROR_CODES.INTERNAL_ERROR, message, 500),
};
