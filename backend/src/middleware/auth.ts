import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { auth } from '../config/firebase';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
    role?: string;
    [key: string]: any;
  };
}

/**
 * Express HTTP Bearer Token Verification Middleware
 */
export async function verifyToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized: No Bearer token provided in Authorization header.'
      }
    });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(token, true);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.display_name,
      role: decodedToken.role || 'student'
    };
    next();
  } catch (error: any) {
    logger.warn('Authentication failure on HTTP endpoint', { error: error.message });
    return res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Forbidden: The provided authentication token is invalid or expired.'
      }
    });
  }
}

/**
 * Optional Authentication Middleware
 * Attaches user if valid Bearer token provided, otherwise allows guest access
 */
export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token || token === 'null' || token === 'undefined') {
    return next();
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name || decodedToken.display_name,
      role: decodedToken.role || 'student'
    };
  } catch (error: any) {
    // Non-fatal for optionalAuth
    logger.debug('Optional auth token invalid, proceeding as guest', { error: error.message });
  }

  next();
}

/**
 * Role-based authorization middleware
 */
export function requireRole(role: 'admin' | 'student' | 'recruiter' | 'mentor') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
}

/**
 * Socket.IO Handshake Authentication Middleware
 * Validates Firebase ID Token passed in socket.handshake.auth.token or query.token
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    // In local development fallback mock mode, allow fallback cadet if no token provided
    if (process.env.NODE_ENV !== 'production' && !process.env.FIREBASE_SERVICE_ACCOUNT) {
      socket.data.userId = 'mock_uid_123';
      socket.data.email = 'cadet@crackplace.ai';
      socket.data.authenticated = true;
      return next();
    }
    return next(new Error('AUTHENTICATION_REQUIRED'));
  }

  try {
    const decoded = await auth.verifyIdToken(String(token), true);
    socket.data.userId = decoded.uid;
    socket.data.email = decoded.email;
    socket.data.authenticated = true;
    next();
  } catch (err: any) {
    logger.warn('Socket connection authentication rejected', { socketId: socket.id, error: err.message });
    next(new Error('INVALID_AUTHENTICATION_TOKEN'));
  }
}
