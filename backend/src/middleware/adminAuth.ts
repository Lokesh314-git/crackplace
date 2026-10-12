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

  const adminEmails = (process.env.ADMIN_EMAILS || 'lokesh.8637427067@gmail.com,admin@crackplace.ai')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  try {
    // 1. Try Firebase Admin Verify
    const decodedToken = await auth.verifyIdToken(token);
    const isFirebaseEmailAdmin = decodedToken.email ? adminEmails.includes(decodedToken.email.toLowerCase()) : false;
    if (decodedToken.role === 'admin' || decodedToken.admin === true || isFirebaseEmailAdmin) {
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

    // Authoritatively check admin role: app_metadata, user_metadata, or admin email whitelist
    const appRole = user.app_metadata?.role || user.user_metadata?.role;
    const isAppAdmin = appRole === 'admin' || user.app_metadata?.claims_admin === true;
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

