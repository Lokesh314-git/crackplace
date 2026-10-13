import { Router, Request, Response } from 'express';
import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, AdminAuthenticatedRequest } from '../middleware/adminAuth';
import { verifyToken, AuthenticatedRequest } from '../middleware/auth';
import { COSMETICS_CATALOG } from '../utils/cosmetics';

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
    const promotions = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      let rewardStatus = data.rewardStatus;
      if (!rewardStatus) {
        if (data.rewardedItems || data.rewardPackage) {
          rewardStatus = 'claimed';
        } else {
          rewardStatus = 'none';
        }
      }
      return {
        ...data,
        rewardStatus,
        rewardPackage: data.rewardPackage || data.rewardedItems || null
      };
    });

    promotions.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    res.json({ promotions });
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// 4.1 Claim promotion rewards (Atomic transaction)
async function handleClaimPromotion(req: AuthenticatedRequest, res: Response) {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing promotion ID' });

    const result = await db.runTransaction(async (transaction: any) => {
      const promoRef = db.collection('promotions').doc(id);
      const promoDoc = await transaction.get(promoRef);
      if (!promoDoc.exists) {
        throw new Error('Promotion not found');
      }

      const promoData = promoDoc.data()!;

      // 1. Authorization: Verify user ownership
      if (promoData.userId !== uid) {
        throw new Error('Forbidden: You can only claim your own rewards');
      }

      // 2. Status verification: Must be approved
      if (promoData.status !== 'approved') {
        throw new Error('Promotion has not been approved');
      }

      // 3. Idempotency / Duplicate-claim protection:
      // If already claimed, return claimed state cleanly without crediting again
      if (promoData.rewardStatus === 'claimed') {
        return {
          alreadyClaimed: true,
          success: true,
          message: 'Reward has already been claimed',
          claimedAt: promoData.claimedAt || promoData.rewardPackage?.claimedAt || null,
          rewardPackage: promoData.rewardPackage || promoData.rewardedItems || null
        };
      }

      // 4. Check claimable status
      const pkg = promoData.rewardPackage || promoData.rewardedItems;
      if (!pkg || (promoData.rewardStatus && promoData.rewardStatus !== 'claimable')) {
        throw new Error('No claimable reward found for this promotion');
      }

      const coins = Number(pkg.coins) || 0;
      const cosmeticIds: string[] = Array.isArray(pkg.cosmeticIds) ? pkg.cosmeticIds : [];

      // Categorize cosmetics by type based on authoritative COSMETICS_CATALOG
      const categorized: Record<string, string[]> = {
        unlockedAvatars: [],
        unlockedRings: [],
        unlockedFrames: [],
        unlockedBackgrounds: [],
        unlockedTitles: [],
        unlockedThemes: [],
        unlockedEmotes: [],
        unlockedStickers: [],
      };

      cosmeticIds.forEach((cId: string) => {
        const item = COSMETICS_CATALOG.find((i: any) => i.id === cId);
        if (item) {
          if (item.category === 'avatar') categorized.unlockedAvatars.push(item.id);
          else if (item.category === 'ring') categorized.unlockedRings.push(item.id);
          else if (item.category === 'frame') categorized.unlockedFrames.push(item.id);
          else if (item.category === 'background') categorized.unlockedBackgrounds.push(item.id);
          else if (item.category === 'title') categorized.unlockedTitles.push(item.id);
          else if (item.category === 'theme') categorized.unlockedThemes.push(item.id);
          else if (item.category === 'emote') categorized.unlockedEmotes.push(item.id);
          else if (item.category === 'sticker') categorized.unlockedStickers.push(item.id);
        } else {
          // Fallback based on item ID prefix if custom item
          if (cId.startsWith('avatar_')) categorized.unlockedAvatars.push(cId);
          else if (cId.startsWith('theme_')) categorized.unlockedThemes.push(cId);
          else if (cId.startsWith('ring_')) categorized.unlockedRings.push(cId);
          else if (cId.startsWith('frame_')) categorized.unlockedFrames.push(cId);
          else if (cId.startsWith('bg_')) categorized.unlockedBackgrounds.push(cId);
          else if (cId.startsWith('title_')) categorized.unlockedTitles.push(cId);
          else if (cId.startsWith('emote_')) categorized.unlockedEmotes.push(cId);
          else if (cId.startsWith('sticker_')) categorized.unlockedStickers.push(cId);
        }
      });

      const userRef = db.collection('users').doc(uid);
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error('User profile not found');
      }

      const userData = userDoc.data()!;
      const userUpdates: any = {};

      if (coins > 0) {
        userUpdates.coins = FieldValue.increment(coins);
      }

      Object.entries(categorized).forEach(([field, ids]) => {
        if (ids.length > 0) {
          userUpdates[field] = FieldValue.arrayUnion(...ids);
        }
      });

      userUpdates.updatedAt = new Date().toISOString();
      transaction.update(userRef, userUpdates);

      const now = new Date().toISOString();
      const updatedPackage = {
        ...pkg,
        claimedAt: now,
        claimedBy: uid
      };

      transaction.update(promoRef, {
        rewardStatus: 'claimed',
        claimedAt: now,
        rewardPackage: updatedPackage,
        rewardedItems: updatedPackage,
        updatedAt: now
      });

      const auditRef = db.collection('auditLogs').doc();
      transaction.set(auditRef, {
        id: auditRef.id,
        type: 'promotion_reward_claimed',
        userId: uid,
        promotionId: id,
        coinsGranted: coins,
        cosmeticsGranted: cosmeticIds,
        timestamp: now
      });

      return {
        alreadyClaimed: false,
        success: true,
        message: 'Rewards claimed successfully!',
        claimedAt: now,
        coinsGranted: coins,
        cosmeticsGranted: cosmeticIds,
        newCoinBalance: (Number(userData.coins) || 0) + coins,
        rewardPackage: updatedPackage
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error claiming promotion reward:', error);
    if (error.message === 'Promotion not found' || error.message === 'User profile not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.startsWith('Forbidden')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Promotion has not been approved' || error.message === 'No claimable reward found for this promotion') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to claim reward' });
  }
}

// User claim endpoints (both supported)
invitePromoteRouter.post('/promotions/:id/claim', verifyToken, handleClaimPromotion);
invitePromoteRouter.post('/rewards/:id/claim', verifyToken, handleClaimPromotion);

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
// ADMIN ROUTES (Protected by adminAuth)
// ==========================================

// 6. Get all promotions for admin
invitePromoteRouter.get('/admin/promotions', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const snapshot = await db.collection('promotions').orderBy('createdAt', 'desc').get();
    const promotions = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      let rewardStatus = data.rewardStatus;
      if (!rewardStatus) {
        if (data.rewardedItems || data.rewardPackage) {
          rewardStatus = 'claimed';
        } else {
          rewardStatus = 'none';
        }
      }
      return {
        ...data,
        rewardStatus,
        rewardPackage: data.rewardPackage || data.rewardedItems || null
      };
    });
    
    res.json({ promotions });
  } catch (error) {
    console.error('Error fetching admin promotions:', error);
    res.status(500).json({ error: 'Failed to fetch promotions' });
  }
});

// 7. Review and grant rewards for a promotion (Stores as Claimable; does NOT credit user account)
invitePromoteRouter.post('/admin/promotions/:id/review', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { id } = req.params;
    const { status, message, rewards, rewardDetails } = req.body;
    
    // Support both payload structures
    const rewardsData = rewards || rewardDetails;

    // Validate coin amount if specified
    if (rewardsData?.coins !== undefined && rewardsData?.coins !== null) {
      const parsedCoins = Number(rewardsData.coins);
      if (!Number.isInteger(parsedCoins) || parsedCoins < 0 || parsedCoins > 100000) {
        return res.status(400).json({ error: 'Coins must be a positive integer between 0 and 100,000' });
      }
    }

    // Validate cosmetic IDs from COSMETICS_CATALOG
    if (rewardsData?.cosmeticIds && Array.isArray(rewardsData.cosmeticIds)) {
      for (const cosmeticId of rewardsData.cosmeticIds) {
        const itemExists = COSMETICS_CATALOG.some(c => c.id === cosmeticId);
        if (!itemExists && !cosmeticId.startsWith('avatar_') && !cosmeticId.startsWith('theme_') && !cosmeticId.startsWith('ring_') && !cosmeticId.startsWith('frame_')) {
          return res.status(400).json({ error: `Invalid cosmetic item ID: "${cosmeticId}". Must exist in catalog.` });
        }
      }
    }

    // Validate cash amount if specified
    if (rewardsData?.cashAmount !== undefined && rewardsData?.cashAmount !== null) {
      const parsedCash = Number(rewardsData.cashAmount);
      if (isNaN(parsedCash) || parsedCash < 0 || parsedCash > 500000) {
        return res.status(400).json({ error: 'Cash amount must be between 0 and 500,000' });
      }
    }

    await db.runTransaction(async (transaction: any) => {
      const promoRef = db.collection('promotions').doc(id);
      const promoDoc = await transaction.get(promoRef);
      if (!promoDoc.exists) throw new Error('Promotion not found');
      
      const promoData = promoDoc.data()!;
      
      // If already claimed by user, prevent changing the reward package
      if (promoData.status === 'approved' && promoData.rewardStatus === 'claimed' && status === 'approved') {
        throw new Error('This reward package has already been claimed by the user and cannot be modified');
      }
      
      // If attempting to reject an already approved one, block
      if (promoData.status === 'approved' && status === 'rejected') {
        throw new Error('Cannot reject an already approved promotion');
      }

      let rewardPackage: any = null;
      let newRewardStatus = promoData.rewardStatus || 'none';

      // Handle rewards if approved
      if (status === 'approved') {
        if (rewardsData) {
          const coins = Number(rewardsData.coins) || 0;
          const cashAmount = Number(rewardsData.cashAmount) || 0;
          const cosmeticIds = Array.isArray(rewardsData.cosmeticIds) ? rewardsData.cosmeticIds : [];
          const customMsg = message || rewardsData.message || 'Thank you for promoting CrackPlace! Your reward is ready to claim.';

          rewardPackage = {
            coins,
            cashAmount,
            currency: rewardsData.currency || 'INR',
            cosmeticIds,
            message: customMsg,
            grantedAt: new Date().toISOString(),
            grantedBy: req.user!.uid
          };

          const hasRewards = coins > 0 || cosmeticIds.length > 0 || cashAmount > 0;
          newRewardStatus = hasRewards ? 'claimable' : (promoData.rewardStatus || 'none');

          // Handle Cash Reward separately in cashRewards collection (pending manual payout workflow)
          if (cashAmount > 0) {
            const cashSnap = await db.collection('cashRewards').where('promotionId', '==', id).get();
            if (cashSnap.empty) {
              const cashRef = db.collection('cashRewards').doc();
              transaction.set(cashRef, {
                id: cashRef.id,
                userId: promoData.userId,
                promotionId: promoData.id,
                amount: cashAmount,
                currency: rewardPackage.currency,
                status: 'Pending Payment',
                adminId: req.user!.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            } else {
              // Update existing cash reward record
              const existingCashDoc = cashSnap.docs[0];
              transaction.update(existingCashDoc.ref, {
                amount: cashAmount,
                currency: rewardPackage.currency,
                updatedAt: new Date().toISOString()
              });
            }
          }
        } else {
          rewardPackage = promoData.rewardPackage || promoData.rewardedItems || null;
        }
      }

      // CRITICAL: We do NOT update the user's coins or cosmetic arrays here!
      // The reward is saved as 'claimable' and will only be credited when user claims it.
      transaction.update(promoRef, {
        status,
        adminMessage: message || promoData.adminMessage || '',
        rewardStatus: newRewardStatus,
        rewardPackage: status === 'approved' ? (rewardPackage || promoData.rewardPackage || null) : null,
        rewardedItems: status === 'approved' ? (rewardPackage || promoData.rewardedItems || null) : null,
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.user!.uid,
        updatedAt: new Date().toISOString()
      });

      // Audit log
      if (status === 'approved' && rewardPackage) {
        const auditRef = db.collection('auditLogs').doc();
        transaction.set(auditRef, {
          id: auditRef.id,
          type: 'promotion_reward_granted',
          adminId: req.user!.uid,
          promotionId: id,
          userId: promoData.userId,
          rewardPackage,
          rewardStatus: newRewardStatus,
          timestamp: new Date().toISOString()
        });
      }
    });

    res.json({ success: true, message: 'Promotion reviewed successfully' });
  } catch (error: any) {
    console.error('Error reviewing promotion:', error);
    if (error.message === 'Promotion not found') return res.status(404).json({ error: error.message });
    if (error.message === 'This reward package has already been claimed by the user and cannot be modified' ||
        error.message === 'Cannot reject an already approved promotion') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to review promotion' });
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
    
    const isPaid = typeof status === 'string' && status.toLowerCase() === 'paid';
    const normalizedStatus = isPaid ? 'Paid' : status;

    await cashRef.update({
      status: normalizedStatus,
      fulfillmentReference: reference || null,
      paidAt: isPaid ? new Date().toISOString() : null,
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
