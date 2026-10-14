import { Router, Request, Response } from 'express';
import { SeasonService } from '../services/SeasonService';
import { adminAuth, AdminAuthenticatedRequest } from '../middleware/adminAuth';
import logger from '../utils/logger';

export const seasonsRouter = Router();
export const adminSeasonsRouter = Router();

/**
 * GET /api/seasons/current
 * Public / Student-safe endpoint returning active season countdown and parameters
 */
seasonsRouter.get('/current', async (req: Request, res: Response) => {
  try {
    const details = await SeasonService.getActiveSeasonDetails();
    return res.json(details);
  } catch (error: any) {
    logger.error('Failed to get active season details', { error: error.message });
    return res.status(500).json({ error: 'Unable to load season details' });
  }
});

/**
 * POST /api/seasons/reset
 * Managed scheduler endpoint.
 * Protected by SCHEDULER_SECRET header or Admin Bearer Token.
 */
seasonsRouter.post('/reset', async (req: Request, res: Response) => {
  const schedulerSecret = process.env.SCHEDULER_SECRET || 'crackplace_scheduler_secret_prod_2026';
  const providedSecret = req.headers['x-scheduler-secret'];

  // Check scheduler secret or admin auth
  if (providedSecret && providedSecret === schedulerSecret) {
    try {
      const result = await SeasonService.executeSeasonReset('render_cron_job', 'scheduler_service');
      return res.json(result);
    } catch (err: any) {
      logger.error('Scheduler seasonal reset failed', { error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // Fallback to admin auth
  return adminAuth(req as AdminAuthenticatedRequest, res, async () => {
    try {
      const adminReq = req as AdminAuthenticatedRequest;
      const adminId = adminReq.user?.email || adminReq.user?.uid || 'admin';
      const result = await SeasonService.executeSeasonReset('admin_api_trigger', adminId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
});

/**
 * GET /api/admin/seasons/settings
 * Admin-only: Retrieve full season settings, active season, last reset, and history
 */
adminSeasonsRouter.get('/settings', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const settings = await SeasonService.getSettings();
    const active = await SeasonService.getActiveSeasonDetails();
    const history = await SeasonService.getSeasonHistory(20);
    const lastReset = history.find(s => s.status === 'completed') || null;

    return res.json({
      settings: {
        decayEnabled: settings.decayEnabled,
        reductionPercentage: settings.reductionPercentage,
        minFloor: settings.minFloor,
        timezone: settings.timezone,
        configuredAt: settings.updatedAt,
        configuredBy: settings.updatedBy
      },
      decayEnabled: settings.decayEnabled,
      reductionPercentage: settings.reductionPercentage,
      minFloor: settings.minFloor,
      timezone: settings.timezone,
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy,
      activeSeason: active,
      lastReset,
      history
    });
  } catch (error: any) {
    logger.error('Failed to get admin season settings', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/seasons/settings
 * Admin-only: Update seasonal reduction percentage, decay enabled, min floor
 */
adminSeasonsRouter.post('/settings', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.email || req.user?.uid || 'admin';
    const { decayEnabled, reductionPercentage, minFloor } = req.body;

    const updated = await SeasonService.updateSettings(adminId, {
      decayEnabled,
      reductionPercentage,
      minFloor
    });

    return res.json({
      success: true,
      message: 'Seasonal Elo settings updated successfully',
      settings: updated
    });
  } catch (error: any) {
    logger.warn('Failed to update season settings', { error: error.message });
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/seasons/trigger-reset
 * Admin-only: Manually trigger season reset
 */
adminSeasonsRouter.post('/trigger-reset', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.email || req.user?.uid || 'admin';
    const { targetSeasonId } = req.body;
    const result = await SeasonService.executeSeasonReset('manual_admin_trigger', adminId, targetSeasonId);
    return res.json(result);
  } catch (error: any) {
    logger.error('Manual admin seasonal reset failed', { error: error.message });
    return res.status(500).json({ error: error.message });
  }
});
