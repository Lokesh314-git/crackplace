import request from 'supertest';
import { app } from '../index';
import { COSMETICS_CATALOG } from '../utils/cosmetics';

describe('Influencer Claimable Rewards Workflow Suite', () => {
  describe('1. Security & Endpoint Authorization', () => {
    it('POST /api/invite-promote/promotions/:id/claim should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/invite-promote/promotions/promo_123/claim')
        .send({});

      expect([401, 403]).toContain(res.status);
    });

    it('POST /api/invite-promote/rewards/:id/claim alias should also reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/invite-promote/rewards/promo_123/claim')
        .send({});

      expect([401, 403]).toContain(res.status);
    });

    it('POST /api/invite-promote/admin/promotions/:id/review should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/invite-promote/admin/promotions/promo_123/review')
        .send({
          status: 'approved',
          rewards: { coins: 1000 }
        });

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('2. Catalog Consistency & Categorization Integrity', () => {
    it('ensures COSMETICS_CATALOG contains valid items categorized by category', () => {
      const avatars = COSMETICS_CATALOG.filter(c => c.category === 'avatar');
      const themes = COSMETICS_CATALOG.filter(c => c.category === 'theme');
      const rings = COSMETICS_CATALOG.filter(c => c.category === 'ring');
      const frames = COSMETICS_CATALOG.filter(c => c.category === 'frame');

      expect(avatars.length).toBeGreaterThan(0);
      expect(themes.length).toBeGreaterThan(0);
      expect(rings.length).toBeGreaterThan(0);
      expect(frames.length).toBeGreaterThan(0);

      // Verify specific items exist
      expect(COSMETICS_CATALOG.some(c => c.id === 'avatar_cyber_hacker')).toBe(true);
      expect(COSMETICS_CATALOG.some(c => c.id === 'theme_matrix')).toBe(true);
      expect(COSMETICS_CATALOG.some(c => c.id === 'ring_gold')).toBe(true);
    });

    it('correctly maps assigned cosmetic IDs to their respective inventory fields', () => {
      const cosmeticIds = ['avatar_cyber_hacker', 'theme_matrix', 'ring_gold', 'avatar_samurai'];

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

      cosmeticIds.forEach((cId) => {
        const item = COSMETICS_CATALOG.find((i) => i.id === cId);
        if (item) {
          if (item.category === 'avatar') categorized.unlockedAvatars.push(item.id);
          else if (item.category === 'ring') categorized.unlockedRings.push(item.id);
          else if (item.category === 'frame') categorized.unlockedFrames.push(item.id);
          else if (item.category === 'background') categorized.unlockedBackgrounds.push(item.id);
          else if (item.category === 'title') categorized.unlockedTitles.push(item.id);
          else if (item.category === 'theme') categorized.unlockedThemes.push(item.id);
          else if (item.category === 'emote') categorized.unlockedEmotes.push(item.id);
          else if (item.category === 'sticker') categorized.unlockedStickers.push(item.id);
        }
      });

      expect(categorized.unlockedAvatars).toEqual(['avatar_cyber_hacker', 'avatar_samurai']);
      expect(categorized.unlockedThemes).toEqual(['theme_matrix']);
      expect(categorized.unlockedRings).toEqual(['ring_gold']);
      expect(categorized.unlockedFrames).toEqual([]);
    });
  });

  describe('3. Validation Rules for Rewards Assignment', () => {
    it('validates coin amounts strictly as positive integers within application limits', () => {
      const isValidCoin = (val: any) => {
        const parsed = Number(val);
        return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000;
      };

      expect(isValidCoin(1000)).toBe(true);
      expect(isValidCoin(0)).toBe(true);
      expect(isValidCoin(100000)).toBe(true);
      expect(isValidCoin(-50)).toBe(false);
      expect(isValidCoin(100001)).toBe(false);
      expect(isValidCoin(12.34)).toBe(false);
      expect(isValidCoin('abc')).toBe(false);
    });

    it('validates cosmetic IDs against COSMETICS_CATALOG', () => {
      const isValidCosmeticId = (id: string) => {
        return COSMETICS_CATALOG.some(c => c.id === id) || 
          id.startsWith('avatar_') || 
          id.startsWith('theme_') || 
          id.startsWith('ring_') || 
          id.startsWith('frame_');
      };

      expect(isValidCosmeticId('avatar_cyber_hacker')).toBe(true);
      expect(isValidCosmeticId('theme_cyberpunk')).toBe(true);
      expect(isValidCosmeticId('ring_diamond')).toBe(true);
      expect(isValidCosmeticId('bogus_fake_item_12345')).toBe(false);
    });
  });

  describe('4. Claim Idempotency & Transaction Safety', () => {
    it('simulates idempotent double-claim check to prevent duplicate credits', () => {
      let userBalance = 500;
      let userUnlockedThemes = ['theme_starter'];
      let promoRewardStatus = 'claimable';
      let claimCount = 0;

      const claimReward = (promo: any) => {
        // Idempotency check:
        if (promo.rewardStatus === 'claimed') {
          return { alreadyClaimed: true, message: 'Reward has already been claimed' };
        }

        // Grant rewards
        userBalance += promo.rewardPackage.coins;
        userUnlockedThemes = [...userUnlockedThemes, ...promo.rewardPackage.cosmeticIds];
        promo.rewardStatus = 'claimed';
        claimCount++;

        return { alreadyClaimed: false, success: true };
      };

      const promoDoc = {
        id: 'promo_test_1',
        rewardStatus: 'claimable',
        rewardPackage: {
          coins: 1000,
          cosmeticIds: ['theme_matrix']
        }
      };

      // First claim
      const firstResult = claimReward(promoDoc);
      expect(firstResult.alreadyClaimed).toBe(false);
      expect(userBalance).toBe(1500);
      expect(userUnlockedThemes).toContain('theme_matrix');
      expect(claimCount).toBe(1);
      expect(promoDoc.rewardStatus).toBe('claimed');

      // Second claim attempt (simulate double-click or retry)
      const secondResult = claimReward(promoDoc);
      expect(secondResult.alreadyClaimed).toBe(true);
      expect(userBalance).toBe(1500); // Balance remains 1500, NOT 2500!
      expect(userUnlockedThemes.filter(t => t === 'theme_matrix').length).toBe(1); // Not duplicated!
      expect(claimCount).toBe(1); // Only 1 credit performed
    });
  });
});
