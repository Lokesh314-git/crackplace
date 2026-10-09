import { Router, Request, Response } from 'express';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export const invitePromoteRouter = Router();

// Extend the Request interface if not already done in the app for authenticated requests
interface AuthenticatedRequest extends Request {
  user?: any;
}

// 1. Track a new referral (called by the frontend after a referred user registers)
invitePromoteRouter.post('/referral/track', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { referrerId } = req.body;
    const newUserId = req.user?.uid;
    const newUserName = req.user?.name || req.user?.email || 'Anonymous Cadet';

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
invitePromoteRouter.get('/referrals', async (req: AuthenticatedRequest, res: Response) => {
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
invitePromoteRouter.post('/promotions', async (req: AuthenticatedRequest, res: Response) => {
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
invitePromoteRouter.get('/promotions', async (req: AuthenticatedRequest, res: Response) => {
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
invitePromoteRouter.get('/cash-rewards', async (req: AuthenticatedRequest, res: Response) => {
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
invitePromoteRouter.get('/admin/promotions', async (req: AuthenticatedRequest, res: Response) => {
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
invitePromoteRouter.post('/admin/promotions/:id/review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { status, message, rewards } = req.body; // rewards: { coins?: number, cosmeticIds?: string[], cashAmount?: number, currency?: string }

    const promoRef = db.collection('promotions').doc(id);
    const promoDoc = await promoRef.get();
    if (!promoDoc.exists) return res.status(404).json({ error: 'Promotion not found' });
    
    const promoData = promoDoc.data()!;
    if (promoData.status === 'approved') return res.status(400).json({ error: 'Already reviewed' });

    // Handle the rewards if approved
    if (status === 'approved' && rewards) {
      const userRef = db.collection('users').doc(promoData.userId);
      const updates: any = {};
      
      if (rewards.coins) {
        updates.coins = FieldValue.increment(rewards.coins);
        // We could also log a transaction here
      }
      
      if (rewards.cosmeticIds && rewards.cosmeticIds.length > 0) {
        updates.unlockedAvatars = FieldValue.arrayUnion(...rewards.cosmeticIds);
        updates.unlockedThemes = FieldValue.arrayUnion(...rewards.cosmeticIds);
        updates.unlockedRings = FieldValue.arrayUnion(...rewards.cosmeticIds);
        updates.unlockedFrames = FieldValue.arrayUnion(...rewards.cosmeticIds);
      }
      
      if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
      }

      // Handle Cash Reward
      if (rewards.cashAmount && rewards.cashAmount > 0) {
        const cashRef = db.collection('cashRewards').doc();
        await cashRef.set({
          id: cashRef.id,
          userId: promoData.userId,
          promotionId: promoData.id,
          amount: rewards.cashAmount,
          currency: rewards.currency || 'USD',
          status: 'Pending Payment',
          adminId: req.user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Update promotion status
    await promoRef.update({
      status,
      adminMessage: message || '',
      rewardedItems: status === 'approved',
      reviewedAt: new Date().toISOString(),
      reviewedBy: req.user.uid
    });

    res.json({ success: true, message: 'Promotion reviewed successfully' });
  } catch (error) {
    console.error('Error reviewing promotion:', error);
    res.status(500).json({ error: 'Failed to review promotion' });
  }
});

// 8. Get all cash rewards for admin
invitePromoteRouter.get('/admin/cash-rewards', async (req: AuthenticatedRequest, res: Response) => {
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
invitePromoteRouter.post('/admin/cash-rewards/:id/status', async (req: AuthenticatedRequest, res: Response) => {
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
invitePromoteRouter.get('/admin/referrals', async (req: AuthenticatedRequest, res: Response) => {
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

export default invitePromoteRouter;
