import { Router, Response } from 'express';
import { db, auth } from '../config/firebase';
import { adminAuth, AdminAuthenticatedRequest } from '../middleware/adminAuth';
import logger from '../utils/logger';
import { invalidateLeaderboardCache, cleanupLeaderboardStaleRecords } from '../services/leaderboardCleanup';

export const adminUsersRouter = Router();

/**
 * Log administrative actions to an audit collection
 */
async function logAdminAction(adminId: string, action: string, targetUserId: string, reason: string, status: 'success' | 'failed' | 'denied', metadata?: any) {
  try {
    const logRef = db.collection('auditLogs').doc();
    await logRef.set({
      id: logRef.id,
      adminId,
      action,
      targetUserId,
      reason,
      status,
      timestamp: new Date().toISOString(),
      metadata: metadata || {}
    });
  } catch (err) {
    logger.error('Failed to write audit log', { error: String(err) });
  }
}

/**
 * GET /api/admin/users
 * Search and list users with pagination
 */
adminUsersRouter.get('/', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      await logAdminAction(req.user?.uid || 'unknown', 'LIST_USERS', 'all', 'Unauthorized access attempt', 'denied');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { page = '1', limit = '50', search = '', status = '' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
    
    // In a real production environment with many users, we'd use Typesense or Algolia.
    // We cap the scan at 1000 to prevent unbounded memory exhaustion while keeping search functional.
    let usersQuery = db.collection('users').orderBy('createdAt', 'desc').limit(1000);
    
    const snapshot = await usersQuery.get();
    let users = snapshot.docs.map((doc: any) => doc.data() as any);
    
    // Filter by status if provided
    if (status) {
      users = users.filter((u: any) => (u.accountStatus || 'active') === status);
    }
    
    // Filter by search term
    if (search) {
      const s = String(search).toLowerCase();
      users = users.filter((u: any) => 
        (u.displayName || '').toLowerCase().includes(s) || 
        (u.email || '').toLowerCase().includes(s) ||
        (u.uid || '').toLowerCase().includes(s)
      );
    }

    const total = users.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedUsers = users.slice(startIndex, startIndex + limitNum);

    const activeUsers = users.filter((u: any) => (u.accountStatus || 'active') === 'active').length;
    const blockedUsers = users.filter((u: any) => u.accountStatus === 'blocked').length;

    res.json({
      users: paginatedUsers,
      total,
      stats: {
        total,
        active: activeUsers,
        blocked: blockedUsers,
        recent: users.filter((u: any) => new Date(u.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length
      }
    });
  } catch (error) {
    logger.error('Error fetching admin users:', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/admin/users/:uid
 * Get detailed profile information
 */
adminUsersRouter.get('/:uid', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { uid } = req.params;
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Get recent referrals
    const referralsSnap = await db.collection('referrals').where('referrerId', '==', uid).limit(5).get();
    const recentReferrals = referralsSnap.docs.map((doc: any) => doc.data());

    // Get recent activity (capped to latest 50 to avoid runaway reads)
    const xpSnap = await db.collection('xpTransactions').where('userId', '==', uid).limit(50).get();
    const recentActivity = xpSnap.docs
      .map((doc: any) => doc.data())
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 10);
    
    // Get moderation history (capped to latest 50)
    const auditSnap = await db.collection('auditLogs').where('targetUserId', '==', uid).limit(50).get();
    const moderationHistory = auditSnap.docs
      .map((doc: any) => doc.data())
      .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

    res.json({
      user: userData,
      recentReferrals,
      recentActivity,
      moderationHistory
    });
  } catch (error) {
    logger.error('Error fetching user details:', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * POST /api/admin/users/:uid/block
 * Block or unblock a user
 */
adminUsersRouter.post('/:uid/block', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      await logAdminAction(req.user?.uid || 'unknown', 'BLOCK_USER', req.params.uid, 'Unauthorized', 'denied');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { uid } = req.params;
    const { blocked, reason, internalNote } = req.body;
    
    if (req.user.uid === uid) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update Firebase Auth to disable/enable the account
    try {
      await auth.updateUser(uid, { disabled: blocked });
      
      // Revoke refresh tokens to force immediate logout if blocking
      if (blocked) {
        await auth.revokeRefreshTokens(uid);
      }
    } catch (authErr) {
      logger.warn('Could not update Firebase Auth disabled state, user might be Supabase only', { uid, error: String(authErr) });
    }

    // Update Firestore user document
    await db.collection('users').doc(uid).update({
      accountStatus: blocked ? 'blocked' : 'active',
      ineligibleForLeaderboard: blocked ? true : false,
      updatedAt: new Date().toISOString()
    });

    // Invalidate leaderboard cache so blocked users are immediately excluded
    await invalidateLeaderboardCache();

    await logAdminAction(req.user.uid, blocked ? 'BLOCK' : 'UNBLOCK', uid, reason || internalNote, 'success', { internalNote });

    res.json({ success: true, message: `User ${blocked ? 'blocked' : 'unblocked'} successfully` });
  } catch (error) {
    logger.error('Error blocking/unblocking user:', { error: String(error) });
    await logAdminAction(req.user!.uid, 'BLOCK_USER', req.params.uid, String(error), 'failed');
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

/**
 * POST /api/admin/users/:uid/delete
 * Soft delete a user safely, tombstone their profile, and immediately purge leaderboard caches
 */
adminUsersRouter.post('/:uid/delete', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      await logAdminAction(req.user?.uid || 'unknown', 'DELETE_USER', req.params.uid, 'Unauthorized', 'denied');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { uid } = req.params;
    const { reason, confirmationPhrase } = req.body;
    
    if (confirmationPhrase !== 'DELETE') {
      return res.status(400).json({ error: 'Invalid confirmation phrase' });
    }

    if (req.user.uid === uid) {
      return res.status(400).json({ error: 'You cannot delete yourself' });
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = userDoc.data();
    if (userData?.role === 'super-admin') {
      return res.status(403).json({ error: 'Cannot delete a super-admin' });
    }

    // Update Firebase Auth to disable the account and scramble email (Soft Deletion)
    // We prefer soft deletion to keep rewards/battle histories intact.
    try {
      await auth.updateUser(uid, { disabled: true });
      await auth.revokeRefreshTokens(uid);
    } catch (authErr) {
      logger.warn('Could not update Firebase Auth disabled state', { uid, error: String(authErr) });
    }

    // Mask PII and mark as permanently deleted & ineligible for leaderboard
    await db.collection('users').doc(uid).update({
      accountStatus: 'deleted',
      isDeleted: true,
      ineligibleForLeaderboard: true,
      deletedAt: new Date().toISOString(),
      displayName: 'Deleted User',
      email: 'deleted_' + uid + '@crackplace.ai',
      bio: '',
      linkedin: '',
      github: '',
      photoURL: null,
      updatedAt: new Date().toISOString()
    });

    // Invalidate leaderboard cache immediately so deleted user never appears in rankings
    await invalidateLeaderboardCache();

    await logAdminAction(req.user.uid, 'DELETE', uid, reason, 'success');

    res.json({ success: true, message: `User soft-deleted successfully and purged from leaderboard rankings` });
  } catch (error) {
    logger.error('Error deleting user:', { error: String(error) });
    await logAdminAction(req.user!.uid, 'DELETE_USER', req.params.uid, String(error), 'failed');
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * POST /api/admin/users/cleanup-leaderboard
 * Trigger manual cleanup of deleted/stale records from leaderboard and purge caches
 */
adminUsersRouter.post('/cleanup-leaderboard', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      await logAdminAction(req.user?.uid || 'unknown', 'CLEANUP_LEADERBOARD', 'system', 'Unauthorized', 'denied');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await cleanupLeaderboardStaleRecords();
    await logAdminAction(req.user.uid, 'CLEANUP_LEADERBOARD', 'system', `Cleaned ${result.cleanedCount} stale records`, 'success', result);

    res.json({
      success: true,
      message: 'Leaderboard cleaned and cache flushed successfully',
      ...result
    });
  } catch (error: any) {
    logger.error('Error during manual leaderboard cleanup:', { error: String(error) });
    await logAdminAction(req.user?.uid || 'unknown', 'CLEANUP_LEADERBOARD', 'system', String(error), 'failed');
    res.status(500).json({ error: 'Failed to clean leaderboard' });
  }
});
