import { Router, Request, Response } from 'express';
import { PagePublishingService } from '../services/PagePublishingService';
import { adminAuth, AdminAuthenticatedRequest } from '../middleware/adminAuth';
import logger from '../utils/logger';

export const pagePublishingRouter = Router();
export const adminPagePublishingRouter = Router();

/**
 * GET /api/page-publishing/status
 * Public, lightweight endpoint for frontend student clients to check publishing status
 */
pagePublishingRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const pageKey = req.query.pageKey as string | undefined;

    if (pageKey) {
      const status = await PagePublishingService.getPageStatus(pageKey);
      return res.json({
        pageKey,
        status
      });
    }

    const statuses = await PagePublishingService.getPublicStatuses();
    return res.json(statuses);
  } catch (error: any) {
    logger.error('Failed to get public page publishing statuses', { error: error.message });
    // Fail safely to coming_soon for all pages
    return res.json({
      study_notes: 'coming_soon',
      coding_workspace: 'coming_soon'
    });
  }
});

/**
 * GET /api/admin/page-publishing
 * Admin-only: Fetch full metadata, routes, timestamps, and admin update identity
 */
adminPagePublishingRouter.get('/', adminAuth, async (_req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const pages = await PagePublishingService.getAdminPageList();
    return res.json({
      success: true,
      pages
    });
  } catch (error: any) {
    logger.error('Failed to retrieve admin page publishing list', { error: error.message });
    return res.status(500).json({ error: error.message || 'Failed to retrieve page publishing settings.' });
  }
});

/**
 * POST /api/admin/page-publishing/:pageKey
 * Admin-only: Update publishing status (publish or set to coming_soon)
 */
adminPagePublishingRouter.post('/:pageKey', adminAuth, async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const { pageKey } = req.params;
    const { status } = req.body;
    const adminId = req.user?.email || req.user?.uid || 'admin';

    if (!status) {
      return res.status(400).json({ error: 'Status is required (must be "coming_soon" or "published").' });
    }

    const updated = await PagePublishingService.updatePageStatus(pageKey, status, adminId);

    return res.json({
      success: true,
      message: `Successfully set ${updated.name} to ${updated.status === 'published' ? 'Published' : 'Coming Soon'}.`,
      page: updated
    });
  } catch (error: any) {
    logger.warn('Failed to update page publishing status', { error: error.message });
    return res.status(400).json({ error: error.message || 'Failed to update page publishing status.' });
  }
});
