import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { auth } from '../config/firebase';
import logger from '../utils/logger';

export interface AdminAuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role: string;
    source: 'firebase' | 'supabase';
  };
}

export async function adminAuth(req: AdminAuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No Bearer token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // 1. Try Firebase Admin Verify
    const decodedToken = await auth.verifyIdToken(token);
    if (decodedToken.role === 'admin') {
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: 'admin',
        source: 'firebase'
      };
      return next();
    }
  } catch (error) {
    // Fall back to Supabase
  }

  try {
    // 2. Try Supabase Verify
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw new Error('Invalid Supabase token');
    }

    // Question Manager admins might have metadata or simply be accepted if they successfully authenticated
    // Check if role is admin (we can assume success means admin if the app restricts registration)
    const role = user.user_metadata?.role || user.app_metadata?.role || 'admin';
    if (role === 'admin') {
      req.user = {
        uid: user.id,
        email: user.email,
        role: 'admin',
        source: 'supabase'
      };
      return next();
    } else {
      return res.status(403).json({ error: 'Forbidden: Not an admin' });
    }
  } catch (error) {
    logger.warn('Admin auth failure', { error: (error as any).message });
    return res.status(403).json({ error: 'Forbidden: Invalid token or insufficient permissions' });
  }
}
