import { Router, Response } from 'express';
import { adminAuth, AdminAuthenticatedRequest } from '../middleware/adminAuth';
import { AdminQuestionService } from '../services/AdminQuestionService';

export const adminQuestionsRouter = Router();

// Ensure all routes are protected by adminAuth
adminQuestionsRouter.use(adminAuth);

adminQuestionsRouter.get('/', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      subject: req.query.subject as string,
      difficulty: req.query.difficulty as string,
      question_type: req.query.question_type as string,
      topic: req.query.topic as string,
      search: req.query.search as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    };
    const result = await AdminQuestionService.getQuestions(filters);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

adminQuestionsRouter.get('/dashboard-stats', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const stats = await AdminQuestionService.getDashboardStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

adminQuestionsRouter.get('/subjects', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const subjects = await AdminQuestionService.getSubjects();
    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

adminQuestionsRouter.get('/subjects/:slug/topics', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const topics = await AdminQuestionService.getTopics(req.params.slug);
    res.json(topics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

adminQuestionsRouter.post('/subjects', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const subject = await AdminQuestionService.createSubject(req.body);
    res.json(subject);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

adminQuestionsRouter.put('/subjects/:id', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const subject = await AdminQuestionService.updateSubject(req.params.id, req.body);
    res.json(subject);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

adminQuestionsRouter.delete('/subjects/:id', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    await AdminQuestionService.deleteSubject(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

adminQuestionsRouter.get('/:id', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const question = await AdminQuestionService.getQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json(question);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

adminQuestionsRouter.post('/', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const question = await AdminQuestionService.createQuestion(req.body);
    res.json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

adminQuestionsRouter.put('/:id', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const question = await AdminQuestionService.updateQuestion(req.params.id, req.body);
    res.json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

adminQuestionsRouter.delete('/:id', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    await AdminQuestionService.deleteQuestion(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

adminQuestionsRouter.post('/bulk', async (req: AdminAuthenticatedRequest, res: Response) => {
  try {
    const { questions, onConflictOption } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const result = await AdminQuestionService.bulkInsertQuestions(questions, onConflictOption);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
