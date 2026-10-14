import { supabase } from '../config/supabase';
import { db } from '../config/firebase';
import logger from '../utils/logger';

export type PagePublishingStatus = 'coming_soon' | 'published';

export interface PageMetadata {
  pageKey: string;
  name: string;
  route: string;
  status: PagePublishingStatus;
  updatedAt: string;
  updatedBy: string;
}

export const SUPPORTED_PAGES: Record<string, { name: string; route: string }> = {
  study_notes: {
    name: 'Study Notes',
    route: '/study-notes'
  },
  coding_workspace: {
    name: 'Coding Workspace',
    route: '/coding'
  }
};

export class PagePublishingService {
  // In-memory cache for fast lookups
  private static cache: Record<string, { status: PagePublishingStatus; updatedAt: string; updatedBy: string }> = {
    study_notes: { status: 'coming_soon', updatedAt: new Date().toISOString(), updatedBy: 'system_default' },
    coding_workspace: { status: 'coming_soon', updatedAt: new Date().toISOString(), updatedBy: 'system_default' }
  };
  private static isInitialized = false;

  /**
   * Initialize and synchronize publishing state from database
   */
  public static async initialize(): Promise<void> {
    try {
      // 1. Try fetching from Supabase PostgreSQL
      if (supabase) {
        const { data, error } = await supabase
          .from('page_publishing_settings')
          .select('page_key, status, updated_at, updated_by');

        if (!error && data && Array.isArray(data) && data.length > 0) {
          for (const row of data) {
            if (row.page_key && (row.status === 'coming_soon' || row.status === 'published')) {
              this.cache[row.page_key] = {
                status: row.status,
                updatedAt: row.updated_at || new Date().toISOString(),
                updatedBy: row.updated_by || 'system'
              };
            }
          }
          this.isInitialized = true;
          logger.info('Page publishing settings loaded from Supabase PostgreSQL', { cache: this.cache });
          return;
        }
      }

      // 2. Fallback to Firestore / mockDB
      if (db) {
        const docSnap = await db.collection('systemSettings').doc('pagePublishing').get();
        if (docSnap.exists) {
          const docData = docSnap.data();
          for (const key of Object.keys(SUPPORTED_PAGES)) {
            if (docData?.[key]?.status) {
              this.cache[key] = {
                status: docData[key].status,
                updatedAt: docData[key].updatedAt || new Date().toISOString(),
                updatedBy: docData[key].updatedBy || 'system'
              };
            }
          }
          this.isInitialized = true;
          logger.info('Page publishing settings loaded from Firestore fallback', { cache: this.cache });
          return;
        }
      }
    } catch (err: any) {
      logger.warn('Failed to load page publishing settings from database, defaulting to coming_soon', { error: err.message });
    }

    this.isInitialized = true;
  }

  /**
   * Get public status dictionary for student clients (e.g. { study_notes: 'coming_soon', coding_workspace: 'coming_soon' })
   */
  public static async getPublicStatuses(): Promise<Record<string, PagePublishingStatus>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const result: Record<string, PagePublishingStatus> = {};
    for (const key of Object.keys(SUPPORTED_PAGES)) {
      result[key] = this.cache[key]?.status || 'coming_soon';
    }
    return result;
  }

  /**
   * Get public status for a single page key
   */
  public static async getPageStatus(pageKey: string): Promise<PagePublishingStatus> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!SUPPORTED_PAGES[pageKey]) {
      return 'coming_soon';
    }

    return this.cache[pageKey]?.status || 'coming_soon';
  }

  /**
   * Check if a page is currently published
   */
  public static async isPagePublished(pageKey: string): Promise<boolean> {
    const status = await this.getPageStatus(pageKey);
    return status === 'published';
  }

  /**
   * Get comprehensive list of pages for admin management interface
   */
  public static async getAdminPageList(): Promise<PageMetadata[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Refresh from database to ensure fresh state
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('page_publishing_settings')
          .select('page_key, status, updated_at, updated_by');

        if (!error && data && Array.isArray(data)) {
          for (const row of data) {
            if (row.page_key && (row.status === 'coming_soon' || row.status === 'published')) {
              this.cache[row.page_key] = {
                status: row.status,
                updatedAt: row.updated_at || new Date().toISOString(),
                updatedBy: row.updated_by || 'system'
              };
            }
          }
        }
      } else if (db) {
        const docSnap = await db.collection('systemSettings').doc('pagePublishing').get();
        if (docSnap.exists) {
          const docData = docSnap.data();
          for (const key of Object.keys(SUPPORTED_PAGES)) {
            if (docData?.[key]?.status) {
              this.cache[key] = {
                status: docData[key].status,
                updatedAt: docData[key].updatedAt || new Date().toISOString(),
                updatedBy: docData[key].updatedBy || 'system'
              };
            }
          }
        }
      }
    } catch {
      // Continue with current cache
    }

    return Object.entries(SUPPORTED_PAGES).map(([key, meta]) => ({
      pageKey: key,
      name: meta.name,
      route: meta.route,
      status: this.cache[key]?.status || 'coming_soon',
      updatedAt: this.cache[key]?.updatedAt || new Date().toISOString(),
      updatedBy: this.cache[key]?.updatedBy || 'system_default'
    }));
  }

  /**
   * Update publishing status for a specific page key (Admin only)
   */
  public static async updatePageStatus(
    pageKey: string,
    status: string,
    adminId: string
  ): Promise<PageMetadata> {
    if (!SUPPORTED_PAGES[pageKey]) {
      throw new Error(`Unknown page key: ${pageKey}. Supported keys are: ${Object.keys(SUPPORTED_PAGES).join(', ')}`);
    }

    if (status !== 'coming_soon' && status !== 'published') {
      throw new Error(`Invalid status: ${status}. Must be either 'coming_soon' or 'published'.`);
    }

    const previous = this.cache[pageKey]?.status || 'coming_soon';
    const nowIso = new Date().toISOString();

    // 1. Update in Supabase PostgreSQL
    let supabaseSuccess = false;
    try {
      if (supabase) {
        const { error } = await supabase
          .from('page_publishing_settings')
          .upsert({
            page_key: pageKey,
            status,
            updated_at: nowIso,
            updated_by: adminId
          }, { onConflict: 'page_key' });

        if (!error) {
          supabaseSuccess = true;
        } else {
          logger.warn('Supabase upsert for page publishing encountered error', { error: error.message });
        }
      }
    } catch (sbErr: any) {
      logger.warn('Failed to persist page publishing in Supabase', { error: sbErr.message });
    }

    // 2. Synchronize to Firestore / mockDB fallback
    try {
      if (db) {
        await db.collection('systemSettings').doc('pagePublishing').set({
          [pageKey]: {
            status,
            updatedAt: nowIso,
            updatedBy: adminId
          }
        }, { merge: true });

        // Write audit log entry
        await db.collection('auditLogs').add({
          action: 'UPDATE_PAGE_PUBLISHING_STATUS',
          pageKey,
          previousStatus: previous,
          newStatus: status,
          adminId,
          timestamp: nowIso,
          supabaseSynced: supabaseSuccess
        });
      }
    } catch (fsErr: any) {
      logger.warn('Failed to persist page publishing in Firestore', { error: fsErr.message });
    }

    // 3. Update in-memory cache
    this.cache[pageKey] = {
      status: status as PagePublishingStatus,
      updatedAt: nowIso,
      updatedBy: adminId
    };

    logger.info('Page publishing status updated successfully', {
      pageKey,
      previousStatus: previous,
      newStatus: status,
      adminId
    });

    return {
      pageKey,
      name: SUPPORTED_PAGES[pageKey].name,
      route: SUPPORTED_PAGES[pageKey].route,
      status: status as PagePublishingStatus,
      updatedAt: nowIso,
      updatedBy: adminId
    };
  }

  /**
   * Reset in-memory cache (Useful for automated test isolation)
   */
  public static resetCacheForTesting(): void {
    this.cache = {
      study_notes: { status: 'coming_soon', updatedAt: new Date().toISOString(), updatedBy: 'test_init' },
      coding_workspace: { status: 'coming_soon', updatedAt: new Date().toISOString(), updatedBy: 'test_init' }
    };
    this.isInitialized = true;
  }
}
