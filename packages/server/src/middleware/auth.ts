import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User, type IUser } from '../models/index.js';
import { errors, logger } from '../utils/index.js';
import type { GoogleOptionalScope } from '@remoranotes/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}

// Verify JWT and attach user to request
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw errors.unauthorized('No authentication token provided');
    }

    // Verify token
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw errors.unauthorized('Token has expired');
      }
      throw errors.unauthorized('Invalid token');
    }

    // Get user from database
    const user = await User.findById(payload.userId);
    if (!user) {
      throw errors.unauthorized('User not found');
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    next(error);
  }
}

// Optional auth - doesn't fail if no token, but populates user if valid token exists
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      const user = await User.findById(payload.userId);
      if (user) {
        req.user = user;
        req.userId = user._id.toString();
      }
    } catch {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next(error);
  }
}

// Require specific Google scopes
export function requireScope(scope: GoogleOptionalScope) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(errors.unauthorized());
    }

    if (!req.user.grantedScopes.includes(scope)) {
      return next(errors.scopeRequired(scope));
    }

    next();
  };
}

// Generate JWT token for user
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

// Set auth cookie
export function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// Clear auth cookie
export function clearAuthCookie(res: Response): void {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'strict' : 'lax',
  });
}
