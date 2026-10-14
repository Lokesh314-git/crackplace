import { db } from '../config/firebase';
import { GAME_CONFIG } from '../game/config/gameConfig';
import { calculateLevelFromXP } from '../utils/gamification';
import { invalidateLeaderboardCache } from './leaderboardCleanup';
import logger from '../utils/logger';

// Asia/Kolkata (IST) is UTC+5:30 = 330 minutes = 19,800,000 milliseconds
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export interface SeasonBoundaries {
  seasonId: string;
  seasonNumber: number;
  startDate: Date;
  endDate: Date;
  nextResetTimestamp: string;
}

export interface SeasonalEloSettings {
  decayEnabled: boolean;
  reductionPercentage: number;
  minFloor: number;
  timezone: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SeasonRecord {
  seasonId: string;
  seasonNumber: number;
  startDate: string;
  endDate: string;
  reductionPercentage: number;
  decayEnabled: boolean;
  minFloor: number;
  status: 'active' | 'processing' | 'completed' | 'failed';
  processedCount: number;
  completedAt?: string | null;
  errorDetails?: string | null;
  createdAt: string;
}

export class SeasonService {
  private static isResetting = false;
  private static heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Calculate season boundaries aligned strictly to Monday 00:00:00 IST
   */
  public static getSeasonBoundaries(date: Date = new Date()): SeasonBoundaries {
    // Shift current UTC time into IST reference frame
    const istTimeMs = date.getTime() + IST_OFFSET_MS;
    const istDate = new Date(istTimeMs);

    // Day of week in IST: 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayOfWeek = istDate.getUTCDay();
    // Days since Monday: Mon = 0, Tue = 1, ..., Sun = 6
    const daysSinceMonday = (dayOfWeek + 6) % 7;

    const year = istDate.getUTCFullYear();
    const month = istDate.getUTCMonth();
    const day = istDate.getUTCDate() - daysSinceMonday;

    // Monday 00:00:00.000 IST
    const istStartMs = Date.UTC(year, month, day, 0, 0, 0, 0);
    const startUtcMs = istStartMs - IST_OFFSET_MS;
    const startDate = new Date(startUtcMs);

    // Next Monday 00:00:00.000 IST (exactly 7 days later)
    const endDate = new Date(startUtcMs + 7 * 24 * 60 * 60 * 1000);

    const startIst = new Date(istStartMs);
    const yyyy = startIst.getUTCFullYear();
    const mm = String(startIst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(startIst.getUTCDate()).padStart(2, '0');
    const seasonId = `season_${yyyy}-${mm}-${dd}`;

    // Base Season 1 on October 12, 2026 Monday IST (or 1 if prior)
    const epochStartMs = Date.UTC(2026, 9, 12, 0, 0, 0, 0) - IST_OFFSET_MS;
    const weeksDiff = Math.floor((startUtcMs - epochStartMs) / (7 * 24 * 60 * 60 * 1000));
    const seasonNumber = Math.max(1, 1 + weeksDiff);

    return {
      seasonId,
      seasonNumber,
      startDate,
      endDate,
      nextResetTimestamp: endDate.toISOString()
    };
  }

  /**
   * Get previous season ID given the current season start date
   */
  public static getPreviousSeasonBoundaries(date: Date = new Date()): SeasonBoundaries {
    const current = this.getSeasonBoundaries(date);
    const previousDate = new Date(current.startDate.getTime() - 24 * 60 * 60 * 1000);
    return this.getSeasonBoundaries(previousDate);
  }

  /**
   * Retrieve active system settings for Seasonal Elo
   */
  public static async getSettings(): Promise<SeasonalEloSettings> {
    const defaultSettings: SeasonalEloSettings = {
      decayEnabled: true,
      reductionPercentage: 20,
      minFloor: GAME_CONFIG.elo?.minFloor ?? 100,
      timezone: 'Asia/Kolkata'
    };

    try {
      if (!db) return defaultSettings;
      const doc = await db.collection('systemSettings').doc('seasonalElo').get();
      if (doc.exists) {
        const data = doc.data() || {};
        return {
          decayEnabled: typeof data.decayEnabled === 'boolean' ? data.decayEnabled : defaultSettings.decayEnabled,
          reductionPercentage: typeof data.reductionPercentage === 'number' 
            ? Math.min(30, Math.max(10, Math.round(data.reductionPercentage))) 
            : defaultSettings.reductionPercentage,
          minFloor: typeof data.minFloor === 'number' ? Math.max(100, data.minFloor) : defaultSettings.minFloor,
          timezone: 'Asia/Kolkata',
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        };
      }
    } catch (err) {
      logger.warn('Failed to read seasonalElo settings from database, using defaults', { error: String(err) });
    }

    return defaultSettings;
  }

  /**
   * Update system settings with server-side validation and audit logging
   */
  public static async updateSettings(
    adminId: string,
    updates: { decayEnabled?: boolean; reductionPercentage?: number; minFloor?: number }
  ): Promise<SeasonalEloSettings> {
    const current = await this.getSettings();

    let newPercentage = current.reductionPercentage;
    if (updates.reductionPercentage !== undefined) {
      const p = Number(updates.reductionPercentage);
      if (isNaN(p) || !Number.isInteger(p) || p < 10 || p > 30) {
        throw new Error('Reduction percentage must be an integer between 10% and 30%.');
      }
      newPercentage = p;
    }

    let newMinFloor = current.minFloor;
    if (updates.minFloor !== undefined) {
      const mf = Number(updates.minFloor);
      if (isNaN(mf) || mf < 100) {
        throw new Error('Minimum Elo floor must be at least 100.');
      }
      newMinFloor = mf;
    }

    const newDecayEnabled = updates.decayEnabled !== undefined ? Boolean(updates.decayEnabled) : current.decayEnabled;

    const newSettings: SeasonalEloSettings = {
      decayEnabled: newDecayEnabled,
      reductionPercentage: newPercentage,
      minFloor: newMinFloor,
      timezone: 'Asia/Kolkata',
      updatedAt: new Date().toISOString(),
      updatedBy: adminId
    };

    if (db) {
      await db.collection('systemSettings').doc('seasonalElo').set(newSettings, { merge: true });

      // Audit log the setting change
      try {
        const auditRef = db.collection('auditLogs').doc();
        await auditRef.set({
          id: auditRef.id,
          adminId,
          action: 'UPDATE_SEASONAL_ELO_SETTINGS',
          targetUserId: 'system',
          reason: 'Administrator updated weekly seasonal Elo decay parameters',
          status: 'success',
          timestamp: new Date().toISOString(),
          metadata: {
            previous: current,
            updated: newSettings
          }
        });
      } catch (auditErr) {
        logger.error('Failed to write audit log for seasonal settings update', { error: String(auditErr) });
      }
    }

    logger.info('Seasonal Elo settings updated successfully', { newSettings });
    return newSettings;
  }

  /**
   * Retrieve active season metadata for client consumption (public/student-safe)
   */
  public static async getActiveSeasonDetails(): Promise<{
    seasonId: string;
    seasonNumber: number;
    startDate: string;
    endDate: string;
    nextResetTimestamp: string;
    timeRemainingMs: number;
    reductionPercentage: number;
    decayEnabled: boolean;
    timezone: string;
  }> {
    const boundaries = this.getSeasonBoundaries();
    const settings = await this.getSettings();
    const now = Date.now();
    const timeRemainingMs = Math.max(0, boundaries.endDate.getTime() - now);

    return {
      seasonId: boundaries.seasonId,
      seasonNumber: boundaries.seasonNumber,
      startDate: boundaries.startDate.toISOString(),
      endDate: boundaries.endDate.toISOString(),
      nextResetTimestamp: boundaries.nextResetTimestamp,
      timeRemainingMs,
      reductionPercentage: settings.reductionPercentage,
      decayEnabled: settings.decayEnabled,
      timezone: 'Asia/Kolkata'
    };
  }

  /**
   * Retrieve season history for admin operational visibility
   */
  public static async getSeasonHistory(limitCount: number = 20): Promise<SeasonRecord[]> {
    if (!db) return [];

    try {
      const snap = await db.collection('seasons')
        .orderBy('startDate', 'desc')
        .limit(limitCount)
        .get();

      if (!snap || snap.empty) return [];

      return snap.docs.map((doc: any) => {
        const d = doc.data();
        return {
          seasonId: doc.id,
          seasonNumber: d.seasonNumber || 1,
          startDate: d.startDate || '',
          endDate: d.endDate || '',
          reductionPercentage: d.reductionPercentage ?? 20,
          decayEnabled: d.decayEnabled ?? true,
          minFloor: d.minFloor ?? 100,
          status: d.status || 'completed',
          processedCount: d.processedCount || 0,
          completedAt: d.completedAt || null,
          errorDetails: d.errorDetails || null,
          createdAt: d.createdAt || ''
        };
      });
    } catch (err) {
      logger.warn('Failed to fetch season history', { error: String(err) });
      return [];
    }
  }

  /**
   * Authoritatively execute weekly season reset.
   * Decreases eligible players' current Elo by configured percentage.
   * Completely idempotent: Never reduces the same player twice for the same season.
   */
  public static async executeSeasonReset(
    reason: string = 'scheduled_weekly_reset',
    triggeredBy: string = 'system_scheduler',
    targetSeasonId?: string
  ): Promise<{
    success: boolean;
    seasonId: string;
    processedCount: number;
    decayEnabled: boolean;
    reductionPercentage: number;
    message: string;
  }> {
    if (this.isResetting) {
      logger.warn('Season reset already executing (concurrency lock)');
      return {
        success: false,
        seasonId: targetSeasonId || 'unknown',
        processedCount: 0,
        decayEnabled: false,
        reductionPercentage: 0,
        message: 'Reset already in progress'
      };
    }

    this.isResetting = true;

    try {
      const settings = await this.getSettings();
      // If targetSeasonId is not supplied, we evaluate the season that just completed
      const previousBoundaries = this.getPreviousSeasonBoundaries();
      const seasonToResetId = targetSeasonId || previousBoundaries.seasonId;
      const seasonDocRef = db ? db.collection('seasons').doc(seasonToResetId) : null;

      // 1. Idempotency Check on Season Record
      if (seasonDocRef) {
        const existingDoc = await seasonDocRef.get();
        if (existingDoc.exists && existingDoc.data()?.status === 'completed') {
          logger.info(`Season ${seasonToResetId} reset already completed previously (idempotent skip).`);
          return {
            success: true,
            seasonId: seasonToResetId,
            processedCount: existingDoc.data()?.processedCount || 0,
            decayEnabled: existingDoc.data()?.decayEnabled ?? settings.decayEnabled,
            reductionPercentage: existingDoc.data()?.reductionPercentage ?? settings.reductionPercentage,
            message: `Season ${seasonToResetId} was already completed.`
          };
        }

        // Mark season processing
        await seasonDocRef.set({
          seasonId: seasonToResetId,
          seasonNumber: previousBoundaries.seasonNumber,
          startDate: previousBoundaries.startDate.toISOString(),
          endDate: previousBoundaries.endDate.toISOString(),
          reductionPercentage: settings.reductionPercentage,
          decayEnabled: settings.decayEnabled,
          minFloor: settings.minFloor,
          status: 'processing',
          reason,
          triggeredBy,
          startedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Fetch all users from Firestore
      if (!db) {
        throw new Error('Database not initialized');
      }

      const usersSnap = await db.collection('users').get();
      const allUsers = usersSnap.docs.map((d: any) => ({ uid: d.id, ...d.data() }));

      let processedCount = 0;
      const batchSize = 400; // Safe Firestore batch threshold (< 500)
      let currentBatch = db.batch();
      let operationsInBatch = 0;

      const resetTimestamp = new Date().toISOString();

      for (const user of allUsers) {
        // Skip soft-deleted or blocked users
        if (user.accountStatus === 'deleted' || user.accountStatus === 'blocked' || user.isDeleted) {
          continue;
        }

        // Per-user idempotency guard: Do not reduce if user was already processed for this season
        if (user.lastSeasonResetId === seasonToResetId) {
          continue;
        }

        const currentElo = Number(user.battleRating ?? user.eloRating ?? GAME_CONFIG.elo.startingRating);
        let newElo = currentElo;
        let amountReduced = 0;

        if (settings.decayEnabled) {
          // Formula: newElo = round(currentElo * (1 - reductionPercentage / 100))
          amountReduced = Math.round(currentElo * (settings.reductionPercentage / 100));
          newElo = Math.max(settings.minFloor, currentElo - amountReduced);
        }

        const userRef = db.collection('users').doc(user.uid);
        currentBatch.update(userRef, {
          battleRating: newElo,
          eloRating: newElo,
          lastSeasonResetId: seasonToResetId,
          lastSeasonResetAt: resetTimestamp
        });
        operationsInBatch++;

        // Add audit record for rating change
        const auditRef = db.collection('seasonResetAudit').doc(`${seasonToResetId}_${user.uid}`);
        currentBatch.set(auditRef, {
          id: `${seasonToResetId}_${user.uid}`,
          seasonId: seasonToResetId,
          userId: user.uid,
          oldElo: currentElo,
          newElo,
          amountReduced,
          reductionPercentage: settings.reductionPercentage,
          decayEnabled: settings.decayEnabled,
          resetTimestamp
        });
        operationsInBatch++;

        processedCount++;

        // Commit batch when reaching capacity
        if (operationsInBatch >= batchSize) {
          await currentBatch.commit();
          currentBatch = db.batch();
          operationsInBatch = 0;
        }
      }

      // Commit remaining batch operations
      if (operationsInBatch > 0) {
        await currentBatch.commit();
      }

      // 3. Complete Season Document
      if (seasonDocRef) {
        await seasonDocRef.set({
          status: 'completed',
          processedCount,
          completedAt: new Date().toISOString(),
          errorDetails: null
        }, { merge: true });
      }

      // 4. Ensure next/current active season document exists
      const currentBoundaries = this.getSeasonBoundaries();
      const currentSeasonRef = db.collection('seasons').doc(currentBoundaries.seasonId);
      const currentSeasonDoc = await currentSeasonRef.get();
      if (!currentSeasonDoc.exists) {
        await currentSeasonRef.set({
          seasonId: currentBoundaries.seasonId,
          seasonNumber: currentBoundaries.seasonNumber,
          startDate: currentBoundaries.startDate.toISOString(),
          endDate: currentBoundaries.endDate.toISOString(),
          reductionPercentage: settings.reductionPercentage,
          decayEnabled: settings.decayEnabled,
          minFloor: settings.minFloor,
          status: 'active',
          processedCount: 0,
          createdAt: new Date().toISOString()
        });
      }

      // 5. Invalidate Leaderboard Caches in Redis
      try {
        await invalidateLeaderboardCache();
      } catch (cacheErr) {
        logger.warn('Failed to clear leaderboard caches after seasonal reset', { error: String(cacheErr) });
      }

      logger.info('Seasonal Elo reset completed successfully', {
        seasonId: seasonToResetId,
        processedCount,
        decayEnabled: settings.decayEnabled,
        reductionPercentage: settings.reductionPercentage
      });

      return {
        success: true,
        seasonId: seasonToResetId,
        processedCount,
        decayEnabled: settings.decayEnabled,
        reductionPercentage: settings.reductionPercentage,
        message: `Reset completed for season ${seasonToResetId}. Processed ${processedCount} players.`
      };
    } catch (error: any) {
      logger.error('Failed to execute seasonal Elo reset', { error: error.message, stack: error.stack });
      return {
        success: false,
        seasonId: targetSeasonId || 'unknown',
        processedCount: 0,
        decayEnabled: false,
        reductionPercentage: 0,
        message: `Reset failed: ${error.message}`
      };
    } finally {
      this.isResetting = false;
    }
  }

  /**
   * Background Heartbeat Scheduler
   * Checks every 60 seconds if the weekly reset is due.
   */
  public static startSeasonScheduler() {
    if (this.heartbeatInterval) return;

    logger.info('Starting Seasonal Elo background heartbeat checker (every 60s, IST-aligned)...');

    const checkAndTrigger = async () => {
      try {
        const boundaries = this.getSeasonBoundaries();
        // Check if the previous season was reset
        const prev = this.getPreviousSeasonBoundaries();
        if (db) {
          const prevDoc = await db.collection('seasons').doc(prev.seasonId).get();
          if (!prevDoc.exists || prevDoc.data()?.status !== 'completed') {
            logger.info(`Detected uncompleted season ${prev.seasonId}. Initiating authoritative weekly reset...`);
            await this.executeSeasonReset('weekly_heartbeat_catchup', 'background_heartbeat', prev.seasonId);
          }
        }
      } catch (err) {
        logger.warn('Seasonal reset heartbeat check encountered error', { error: String(err) });
      }
    };

    // Run check 5 seconds after server boot, then every 60 seconds
    const bootTimer = setTimeout(checkAndTrigger, 5000);
    if (bootTimer && typeof bootTimer.unref === 'function') {
      bootTimer.unref();
    }
    this.heartbeatInterval = setInterval(checkAndTrigger, 60000);
    if (this.heartbeatInterval && typeof this.heartbeatInterval.unref === 'function') {
      this.heartbeatInterval.unref();
    }
  }

  public static stopSeasonScheduler() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
