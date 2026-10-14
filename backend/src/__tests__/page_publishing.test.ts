import request from 'supertest';
import { app } from '../index';
import { PagePublishingService } from '../services/PagePublishingService';
import { AIService } from '../services/AIService';

describe('Page Publishing & Coming Soon Architecture Suite', () => {
  const adminToken = `header.${Buffer.from(JSON.stringify({ uid: 'admin_test_1', email: 'admin@crackplace.ai', role: 'admin' })).toString('base64')}.sig`;
  const studentToken = `header.${Buffer.from(JSON.stringify({ uid: 'student_test_1', email: 'student@crackplace.ai', role: 'student' })).toString('base64')}.sig`;

  beforeEach(() => {
    PagePublishingService.resetCacheForTesting();
  });

  describe('1. Public Status Endpoint (GET /api/page-publishing/status)', () => {
    it('returns coming_soon as the safe default for both study_notes and coding_workspace', async () => {
      const res = await request(app).get('/api/page-publishing/status');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        study_notes: 'coming_soon',
        coding_workspace: 'coming_soon'
      });
    });

    it('returns single status when query param pageKey is provided', async () => {
      const res = await request(app).get('/api/page-publishing/status?pageKey=study_notes');
      expect(res.status).toBe(200);
      expect(res.body.pageKey).toBe('study_notes');
      expect(res.body.status).toBe('coming_soon');
    });

    it('returns coming_soon fallback for unknown pageKey query', async () => {
      const res = await request(app).get('/api/page-publishing/status?pageKey=non_existent_page');
      expect(res.status).toBe(200);
      expect(res.body.pageKey).toBe('non_existent_page');
      expect(res.body.status).toBe('coming_soon');
    });
  });

  describe('2. Admin Management Endpoints & Authorization', () => {
    it('rejects unauthenticated requests to GET /api/admin/page-publishing', async () => {
      const res = await request(app).get('/api/admin/page-publishing');
      expect(res.status).toBe(401);
    });

    it('rejects student users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/page-publishing')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('allows authorized admins to retrieve all page cards with metadata', async () => {
      const res = await request(app)
        .get('/api/admin/page-publishing')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.pages)).toBe(true);
      expect(res.body.pages.length).toBe(2);

      const study = res.body.pages.find((p: any) => p.pageKey === 'study_notes');
      expect(study).toBeDefined();
      expect(study.name).toBe('Study Notes');
      expect(study.route).toBe('/study-notes');
      expect(study.status).toBe('coming_soon');

      const coding = res.body.pages.find((p: any) => p.pageKey === 'coding_workspace');
      expect(coding).toBeDefined();
      expect(coding.name).toBe('Coding Workspace');
      expect(coding.route).toBe('/coding');
      expect(coding.status).toBe('coming_soon');
    });
  });

  describe('3. Admin Status Update & Independent Control', () => {
    it('rejects invalid pageKey with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/admin/page-publishing/invalid_page_key')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'published' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unknown page key');
    });

    it('rejects invalid status value with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/admin/page-publishing/study_notes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'invalid_status_value' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid status');
    });

    it('rejects student from modifying page publishing status', async () => {
      const res = await request(app)
        .post('/api/admin/page-publishing/study_notes')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ status: 'published' });

      expect(res.status).toBe(403);
    });

    it('allows admin to publish study_notes while coding_workspace remains coming_soon (independence)', async () => {
      const updateRes = await request(app)
        .post('/api/admin/page-publishing/study_notes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'published' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.page.status).toBe('published');

      // Verify public status endpoint reflects independent states
      const publicRes = await request(app).get('/api/page-publishing/status');
      expect(publicRes.body.study_notes).toBe('published');
      expect(publicRes.body.coding_workspace).toBe('coming_soon');
    });

    it('allows admin to toggle published page back to coming_soon safely', async () => {
      // First publish
      await PagePublishingService.updatePageStatus('study_notes', 'published', 'admin_test');
      expect(await PagePublishingService.isPagePublished('study_notes')).toBe(true);

      // Revert to coming_soon
      const revertRes = await request(app)
        .post('/api/admin/page-publishing/study_notes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'coming_soon' });

      expect(revertRes.status).toBe(200);
      expect(revertRes.body.page.status).toBe('coming_soon');
      expect(await PagePublishingService.isPagePublished('study_notes')).toBe(false);
    });
  });

  describe('4. Server-Side Guard on AI Generation Routes', () => {
    it('blocks student from generating study notes when study_notes is coming_soon', async () => {
      await PagePublishingService.updatePageStatus('study_notes', 'coming_soon', 'admin');

      const res = await request(app)
        .post('/api/study/notes/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          category: 'dsa',
          topic: 'Binary Search',
          depth: 'cheat_sheet'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PAGE_COMING_SOON');
      expect(res.body.error).toContain('coming soon');
    });

    it('blocks student from generating coding challenges when coding_workspace is coming_soon', async () => {
      await PagePublishingService.updatePageStatus('coding_workspace', 'coming_soon', 'admin');

      const res = await request(app)
        .post('/api/coding/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          category: 'Arrays',
          difficulty: 'easy'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PAGE_COMING_SOON');
      expect(res.body.error).toContain('coming soon');
    });

    it('allows AI generation once page is published', async () => {
      await PagePublishingService.updatePageStatus('coding_workspace', 'published', 'admin');

      // Mock AI response to test path past guard
      const aiSpy = jest.spyOn(AIService, 'generateText').mockResolvedValueOnce(JSON.stringify({
        title: 'Two Sum',
        description: 'Find two indices summing to target',
        constraints: ['2 <= nums.length <= 10^4'],
        inputFormat: 'Array and target',
        outputFormat: 'Indices',
        sampleCases: [{ input: '[2,7,11,15], 9', output: '[0,1]' }],
        hiddenCases: [{ input: '[3,2,4], 6', output: '[1,2]' }],
        starterCode: { python: '', java: '', javascript: '', cpp: '' }
      }));

      const res = await request(app)
        .post('/api/coding/generate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          category: 'Arrays',
          difficulty: 'easy'
        });

      expect(res.status).toBe(200);
      expect(res.body.problemId).toBeDefined();
      expect(res.body.title).toBe('Two Sum');
      aiSpy.mockRestore();
    });
  });
});
