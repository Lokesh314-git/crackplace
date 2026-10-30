import request from 'supertest';
import { app } from '../index';
import { QuestionService } from '../services/QuestionService';
import { isTopicMatch, isSubtopicMatch } from '../constants/subjects';

describe('Strict Topic Filtering & Custom Challenge Verification Suite', () => {

  describe('1. Practice Section – Strict Topic Isolation', () => {
    it('TEST 1: Quantitative Aptitude -> Time and Speed yields 100% Time and Speed questions', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'quantitative_aptitude',
        topic: 'Time and Speed',
        count: 5
      });

      expect(result.questions.length).toBe(5);

      // Verify every single question belongs to Time and Speed
      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'Time and Speed')).toBe(true);
        // Explicitly assert it does NOT belong to any unrelated topic
        expect(q.topic.toLowerCase()).not.toContain('percentage');
        expect(q.topic.toLowerCase()).not.toContain('profit');
        expect(q.topic.toLowerCase()).not.toContain('interest');
        expect(q.topic.toLowerCase()).not.toContain('ratio');
      }

      // Verify no duplicates
      const ids = new Set(result.questions.map(q => q.id));
      expect(ids.size).toBe(5);
    });

    it('TEST 2: Quantitative Aptitude -> Percentage yields ONLY Percentage questions', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'quantitative_aptitude',
        topic: 'Percentage',
        count: 5
      });

      expect(result.questions.length).toBe(5);

      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'Percentage')).toBe(true);
        expect(q.topic.toLowerCase()).not.toContain('speed');
        expect(q.topic.toLowerCase()).not.toContain('time and work');
      }

      const ids = new Set(result.questions.map(q => q.id));
      expect(ids.size).toBe(5);
    });

    it('TEST 3: DSA -> Arrays yields ONLY Arrays questions', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'dsa',
        topic: 'Arrays',
        count: 5
      });

      expect(result.questions.length).toBe(5);

      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'Arrays')).toBe(true);
      }

      const ids = new Set(result.questions.map(q => q.id));
      expect(ids.size).toBe(5);
    });

    it('TEST 4: Insufficient questions returns clear message and never silently fills with unrelated topics', async () => {
      // Requesting an excessive number of questions for a specific topic (more than available)
      await expect(
        QuestionService.getPracticeQuestions({
          category: 'quantitative_aptitude',
          topic: 'Time and Speed',
          count: 50
        })
      ).rejects.toThrow(/Not enough questions available/i);

      // Verify HTTP API behavior
      const res = await request(app)
        .post('/api/quiz/generate')
        .send({
          category: 'quantitative_aptitude',
          topic: 'Time and Speed',
          count: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INSUFFICIENT_QUESTIONS');
      expect(res.body.error).toContain('Not enough questions available');
      // Must not return questions
      expect(res.body.questions).toBeUndefined();
    });

    it('TEST 5: Practice API endpoint returns sanitized questions without leaking answers', async () => {
      const res = await request(app)
        .post('/api/quiz/generate')
        .send({
          category: 'quantitative_aptitude',
          topic: 'Time and Speed',
          count: 3
        });

      expect(res.status).toBe(200);
      expect(res.body.questions).toBeDefined();
      expect(res.body.questions.length).toBe(3);

      for (const q of res.body.questions) {
        expect(isTopicMatch(q.topic, 'Time and Speed')).toBe(true);
        expect(q.correctOption).toBeUndefined();
        expect(q.correct_answer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
      }
    });
  });

  describe('2. Battle Arena Custom Challenge – Topic & Subtopic Enforcement', () => {
    it('TEST 6: selectBattleQuestions strictly respects topic and subtopic filters', async () => {
      const questions = await QuestionService.selectBattleQuestions(
        'quantitative_aptitude',
        5,
        'Medium',
        'Time and Speed',
        'Problems on Trains'
      );

      expect(questions.length).toBe(5);

      for (const q of questions) {
        expect(isTopicMatch(q.topic, 'Time and Speed')).toBe(true);
        if (q.subtopic) {
          expect(isSubtopicMatch(q.subtopic, 'Problems on Trains')).toBe(true);
        }
      }
    });

    it('TEST 7: Custom Room creation without Company Pattern correctly persists topic & subtopic in settings', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/create')
        .set('Authorization', 'Bearer user_host_token')
        .send({
          battleType: 'quantitative_aptitude',
          topic: 'Time and Speed',
          subtopic: 'Problems on Trains',
          questionsCount: 5,
          difficulty: 'Medium',
          timeLimit: 30,
          isPrivate: true
        });

      expect(res.status).toBe(200);
      expect(res.body.room).toBeDefined();
      expect(res.body.room.battleType).toBe('quantitative_aptitude');
      expect(res.body.room.settings.topic).toBe('Time and Speed');
      expect(res.body.room.settings.subtopic).toBe('Problems on Trains');
      // Company Pattern must not be required
      expect(res.body.room.settings.company).toBeUndefined();
    });

    it('TEST 8: Backward compatibility: Legacy room creation without topic or subtopic still works', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/create')
        .set('Authorization', 'Bearer user_host_token')
        .send({
          battleType: 'DSA',
          questionsCount: 5,
          difficulty: 'Medium',
          timeLimit: 30
        });

      expect(res.status).toBe(200);
      expect(res.body.room).toBeDefined();
      expect(res.body.room.battleType).toBe('DSA');
      expect(res.body.room.settings.questionsCount).toBe(5);
    });
  });

  describe('3. Taxonomy API Endpoints', () => {
    it('TEST 9: GET /api/quiz/taxonomy returns full subject list', async () => {
      const res = await request(app).get('/api/quiz/taxonomy');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.subjects)).toBe(true);
      expect(res.body.subjects.length).toBeGreaterThanOrEqual(8);
    });

    it('TEST 10: GET /api/quiz/taxonomy/:slug/topics returns topics for Quantitative Aptitude', async () => {
      const res = await request(app).get('/api/quiz/taxonomy/quantitative_aptitude/topics');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.topics)).toBe(true);
      expect(res.body.topics).toContain('Time and Speed');
      expect(res.body.topics).toContain('Percentages');
    });

    it('TEST 11: GET /api/quiz/taxonomy/:slug/topics/:topic/subtopics returns subtopics for Time and Speed', async () => {
      const res = await request(app).get('/api/quiz/taxonomy/quantitative_aptitude/topics/Time%20and%20Speed/subtopics');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.subtopics)).toBe(true);
      expect(res.body.subtopics).toContain('Problems on Trains');
    });
  });
});
