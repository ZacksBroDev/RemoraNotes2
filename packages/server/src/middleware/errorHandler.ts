import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@remoranotes/shared';
import { AppError, logger } from '../utils/index.js';
import { config } from '../config/index.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void {
  // Log error
  if (err instanceof AppError && err.isOperational) {
    logger.warn(
      {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      },
      'Operational error'
    );
  } else {
    logger.error(
      {
        err,
        path: req.path,
        method: req.method,
      },
      'Unhandled error'
    );
  }

  // Handle AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: config.isDev ? { original: err.message } : undefined,
      },
    });
    return;
  }

  // Handle Mongoose duplicate key errors
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    res.status(409).json({
      success: false,
      error: {
        code: 'ALREADY_EXISTS',
        message: 'Resource already exists',
      },
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.isDev ? err.message : 'Internal server error',
    },
  });
}

// 404 handler
export function notFoundHandler(req: Request, res: Response<ApiResponse>): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
