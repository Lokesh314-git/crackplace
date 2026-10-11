import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { auth, db } from '../config/firebase';
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

    // Authoritatively check admin role: app_metadata is server-controlled (cannot be forged by client)
    const appRole = user.app_metadata?.role;
    const isAppAdmin = appRole === 'admin' || user.app_metadata?.claims_admin === true;
    
    // Check optional admin email whitelist
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    const isEmailAdmin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false;

    // Check database role if user exists in Firestore users
    let isDbAdmin = false;
    try {
      const userDoc = await db.collection('users').doc(user.id).get();
      if (userDoc.exists && userDoc.data()?.role === 'admin') {
        isDbAdmin = true;
      }
    } catch {
      // Non-fatal if Firestore is not available
    }

    if (isAppAdmin || isEmailAdmin || isDbAdmin) {
      req.user = {
        uid: user.id,
        email: user.email,
        role: 'admin',
        source: 'supabase'
      };
      return next();
    } else {
      return res.status(403).json({ error: 'Forbidden: Insufficient administrator permissions' });
    }
  } catch (error) {
    logger.warn('Admin auth failure', { error: (error as any).message });
    return res.status(403).json({ error: 'Forbidden: Invalid token or insufficient permissions' });
  }
}
