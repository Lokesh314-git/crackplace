import { db } from '../config/firebase';
import { FieldValue } from 'firebase-admin/firestore';

export async function checkAndFulfillReferral(userId: string) {
  try {
    const referralsRef = db.collection('referrals');
    const querySnapshot = await referralsRef
      .where('referredUserId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    if (querySnapshot.empty) {
      return;
    }

    const referralDoc = querySnapshot.docs[0];
    const referralData = referralDoc.data();
    
    // Reward settings
    const COINS_REWARD = 1500;
    const LEGENDARY_COSMETIC_ID = 'title_crackplace_legend'; // Must match a real or acceptable legendary item

    // Fulfill the referral
    await db.runTransaction(async (transaction: any) => {
      // Re-read to ensure it's still pending
      const latestRef = await transaction.get(referralDoc.ref);
      if (latestRef.data()?.status !== 'pending') return;

      const referrerId = referralData.referrerId;
      const userRef = db.collection('users').doc(referrerId);
      
      // Update Referrer's inventory
      transaction.update(userRef, {
        coins: FieldValue.increment(COINS_REWARD),
        unlockedAvatars: FieldValue.arrayUnion(LEGENDARY_COSMETIC_ID)
      });

      // Update Referral status
      transaction.update(referralDoc.ref, {
        status: 'rewarded',
        rewardedAt: new Date().toISOString(),
        rewardDetails: {
          coins: COINS_REWARD,
          cosmetic: LEGENDARY_COSMETIC_ID
        }
      });
    });

    console.log(`Referral for user ${userId} fulfilled. Rewards sent to ${referralData.referrerId}`);
  } catch (err) {
    console.error('Error fulfilling referral:', err);
  }
}
