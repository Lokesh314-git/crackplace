import { Router, Request, Response } from 'express';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, AdminAuthenticatedRequest } from '../middleware/adminAuth';
import { verifyToken, AuthenticatedRequest } from '../middleware/auth';

export const invitePromoteRouter = Router();

// 1. Track a new referral (called by the frontend after a referred user registers)
invitePromoteRouter.post('/referral/track', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referrerId } = req.body;
    const newUserId = req.user?.uid;
    const newUserName = req.user?.name || req.user?.email || 'Anonymous';

    if (!referrerId || !newUserId) {
      return res.status(400).json({ error: 'Missing referrer or user ID' });
    }

    if (referrerId === newUserId) {
      return res.status(400).json({ error: 'Self-referrals are not allowed' });
    }

    // Check if a referral already exists for this referred user (prevent duplicate tracking)
    const existingRefQuery = await db.collection('referrals').where('referredUserId', '==', newUserId).get();
    if (!existingRefQuery.empty) {
      return res.status(400).json({ error: 'User is already referred' });
    }

    const referralRef = db.collection('referrals').doc();
    await referralRef.set({
      id: referralRef.id,
      referrerId,
      referredUserId: newUserId,
      referredDisplayName: newUserName,
      status: 'pending', // pending, rewarded
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Referral tracked' });
  } catch (error) {
    console.error('Error tracking referral:', error);
    res.status(500).json({ error: 'Failed to track referral' });
  }
});

// 2. Fetch current user's referrals
invitePromoteRouter.get('/referrals', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const snapshot = await db.collection('referrals').where('referrerId', '==', uid).get();
    const referrals = snapshot.docs.map((doc: any) => doc.data());
    
    res.json({ referrals });
  } catch (error) {
    console.error('Error fetching referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// 3. Submit a new promotion (influencer video)
invitePromoteRouter.post('/promotions', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { videoUrl, platform } = req.body;
    const uid = req.user?.uid;

    if (!uid || !videoUrl || !platform) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const promoRef = db.collection('promotions').doc();
    await promoRef.set({
      id: promoRef.id,
      userId: uid,
      videoUrl,
      platform,
      status: 'pending', // pending, approved, rejected
      adminMessage: '',
      rewardedItems: false,
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Promotion submitted' });
  } catch (error) {
    console.error('Error submitting promotion:', error);
    res.status(500).json({ error: 'Failed to submit promotion' });
  }
});

// 4. Fetch current user's promotions
invitePromoteRouter.get('/promotions', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const snapshot = await db.collection('promotions').where('userId', '==', uid).get();
    const promotions = snapshot.docs.map((doc: any) => doc.data());
    
    res.json({ promotions });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// 5. Fetch current user's cash rewards
invitePromoteRouter.get('/cash-rewards', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const snapshot = await db.collection('cashRewards').where('userId', '==', uid).get();
    const cashRewards = snapshot.docs.map((doc: any) => doc.data());
    
    res.json({ cashRewards });
  } catch (error) {
    console.error('Error fetching cash rewards:', error);
    res.status(500).json({ error: 'Failed to fetch cash rewards' });
  }
});

// ==========================================
// ADMIN ROUTES (Should ideally be protected by requireRole('admin'))
// ==========================================

// 6. Get all promotions for admin
invitePromoteRouter.get('/admin/promotions', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const snapshot = await db.collection('promotions').orderBy('createdAt', 'desc').get();
    const promotions = snapshot.docs.map((doc: any) => doc.data());
    
    res.json({ promotions });
  } catch (error) {
    console.error('Error fetching admin promotions:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// 7. Review and grant rewards for a promotion
invitePromoteRouter.post('/admin/promotions/:id/review', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { status, message, rewards, rewardDetails } = req.body;
    
    // Support both payload structures
    const rewardsData = rewards || rewardDetails;

    await db.runTransaction(async (transaction: any) => {
      const promoRef = db.collection('promotions').doc(id);
      const promoDoc = await transaction.get(promoRef);
      if (!promoDoc.exists) throw new Error('Promotion not found');
      
      const promoData = promoDoc.data()!;
      
      // If already fully reviewed and rewarded, block.
      if (promoData.status === 'approved' && promoData.rewardedItems && status === 'approved') {
        throw new Error('Already reviewed and rewarded');
      }
      
      // If attempting to reject an already approved one, block (prevent abuse)
      if (promoData.status === 'approved' && status === 'rejected') {
        throw new Error('Cannot reject an already approved promotion');
      }

      // Handle the rewards if approved
      if (status === 'approved' && rewardsData) {
        const userRef = db.collection('users').doc(promoData.userId);
        
        const updates: any = {};
        
        if (rewardsData.coins) {
          updates.coins = FieldValue.increment(rewardsData.coins);
        }
        
        if (rewardsData.cosmeticIds && rewardsData.cosmeticIds.length > 0) {
          updates.unlockedAvatars = FieldValue.arrayUnion(...rewardsData.cosmeticIds);
          updates.unlockedThemes = FieldValue.arrayUnion(...rewardsData.cosmeticIds);
          updates.unlockedRings = FieldValue.arrayUnion(...rewardsData.cosmeticIds);
          updates.unlockedFrames = FieldValue.arrayUnion(...rewardsData.cosmeticIds);
        }
        
        if (Object.keys(updates).length > 0) {
          transaction.update(userRef, updates);
        }

        // Handle Cash Reward
        if (rewardsData.cashAmount && rewardsData.cashAmount > 0) {
          const cashRef = db.collection('cashRewards').doc();
          transaction.set(cashRef, {
            id: cashRef.id,
            userId: promoData.userId,
            promotionId: promoData.id,
            amount: rewardsData.cashAmount,
            currency: rewardsData.currency || 'INR',
            status: 'pending', // Make sure this matches cash workflow 'pending'
            adminId: req.user!.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Update promotion status
      transaction.update(promoRef, {
        status,
        adminMessage: message || promoData.adminMessage || '',
        rewardedItems: status === 'approved' && rewardsData ? rewardsData : promoData.rewardedItems,
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.user!.uid
      });
    });

    res.json({ success: true, message: 'Promotion reviewed successfully' });
  } catch (error: any) {
    console.error('Error reviewing promotion:', error);
    if (error.message === 'Promotion not found') return res.status(404).json({ error: error.message });
    if (error.message === 'Already reviewed and rewarded' || error.message === 'Cannot reject an already approved promotion') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to review promotion' });
  }
});

// 8. Get all cash rewards for admin
invitePromoteRouter.get('/admin/cash-rewards', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const snapshot = await db.collection('cashRewards').orderBy('createdAt', 'desc').get();
    const cashRewards = snapshot.docs.map((doc: any) => doc.data());
    
    res.json({ cashRewards });
  } catch (error) {
    console.error('Error fetching admin cash rewards:', error);
    res.status(500).json({ error: 'Failed to fetch cash rewards' });
  }
});

// 9. Update cash payment status
invitePromoteRouter.post('/admin/cash-rewards/:id/status', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { status, reference } = req.body;

    const cashRef = db.collection('cashRewards').doc(id);
    const cashDoc = await cashRef.get();
    if (!cashDoc.exists) return res.status(404).json({ error: 'Cash reward not found' });
    
    await cashRef.update({
      status,
      fulfillmentReference: reference || null,
      paidAt: status === 'Paid' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
      fulfillmentAdminId: req.user.uid
    });

    res.json({ success: true, message: 'Cash reward status updated' });
  } catch (error) {
    console.error('Error updating cash status:', error);
    res.status(500).json({ error: 'Failed to update cash status' });
  }
});

// 10. Get all referrals for admin
invitePromoteRouter.get('/admin/referrals', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const snapshot = await db.collection('referrals').orderBy('createdAt', 'desc').get();
    const referrals = snapshot.docs.map((doc: any) => doc.data());
    
    res.json({ referrals });
  } catch (error) {
    console.error('Error fetching admin referrals:', error);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// 11. Get Growth Dashboard Stats
invitePromoteRouter.get('/admin/dashboard', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    // Fetch counts from various collections
    const [
      referralsSnapshot,
      promotionsSnapshot,
      cashRewardsSnapshot
    ] = await Promise.all([
      db.collection('referrals').get(),
      db.collection('promotions').get(),
      db.collection('cashRewards').get()
    ]);

    const referrals = referralsSnapshot.docs.map((d: any) => d.data());
    const promotions = promotionsSnapshot.docs.map((d: any) => d.data());
    const cashRewards = cashRewardsSnapshot.docs.map((d: any) => d.data());

    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter((r: any) => r.status === 'completed').length;
    const pendingReferrals = referrals.filter((r: any) => r.status === 'pending').length;

    const totalPromotions = promotions.length;
    const pendingPromotions = promotions.filter((p: any) => p.status === 'pending').length;
    const approvedPromotions = promotions.filter((p: any) => p.status === 'approved').length;

    const pendingCashPayments = cashRewards.filter((c: any) => c.status === 'pending').length;
    const completedCashPayments = cashRewards.filter((c: any) => c.status === 'paid').length;

    // Approximated coins issued
    const totalCoinsIssued = completedReferrals * 1500; 

    res.json({
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalPromotions,
      pendingPromotions,
      approvedPromotions,
      pendingCashPayments,
      completedCashPayments,
      totalCoinsIssued,
      recentActivity: [] // placeholder
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// 12. Get Audit Logs
invitePromoteRouter.get('/admin/audit-logs', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const snapshot = await db.collection('auditLogs').orderBy('createdAt', 'desc').limit(50).get();
    const logs = snapshot.docs.map((d: any) => d.data());

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default invitePromoteRouter;
