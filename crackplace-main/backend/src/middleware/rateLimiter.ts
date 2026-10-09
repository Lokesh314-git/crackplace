import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import logger from '../utils/logger';

// 1. General API Rate Limiter: 200 requests per minute
export const standardApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please slow down.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 2. Strict Auth & Mutation Limiter: 30 requests per minute
export const strictAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many verification attempts. Please wait a minute.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 3. AI Endpoint Limiter: 20 requests per minute
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'AI Assistant quota reached for this minute. Please wait.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 4. Socket.IO Event Rate Limiter
const socketEventTracker = new Map<string, { count: number; resetAt: number }>();

export function socketRateLimit(socket: Socket, maxEventsPerSec: number = 10): boolean {
  const now = Date.now();
  const socketId = socket.id;
  const tracker = socketEventTracker.get(socketId) || { count: 0, resetAt: now + 1000 };

  if (now > tracker.resetAt) {
    tracker.count = 1;
    tracker.resetAt = now + 1000;
  } else {
    tracker.count++;
  }

  socketEventTracker.set(socketId, tracker);

  if (tracker.count > maxEventsPerSec) {
    logger.warn('Socket event rate limit exceeded', { socketId, count: tracker.count });
    socket.emit('rate_limit_warning', { message: 'Action throttled. Too many rapid events.' });
    return false;
  }

  return true;
}
