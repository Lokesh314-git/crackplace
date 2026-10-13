import request from 'supertest';
import { app } from '../index';
import { db } from '../config/firebase';
import { QuestionService } from '../services/QuestionService';

describe('Security & Vulnerability Remediation Suite (Phase 3 & Phase 6)', () => {
  describe('1. CORS Defense & Origin Lockdown', () => {
    it('should reject unauthorized malicious origin requests', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'https://malicious-hacker-site.com');

      // Supertest returns either an error or header without Access-Control-Allow-Origin matching malicious site
      expect(res.headers['access-control-allow-origin']).not.toBe('https://malicious-hacker-site.com');
    });

    it('should allow authorized origins', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('2. Quiz Answer Key & Explanation Protection', () => {
    it('should not leak correctOptionIndex or explanation in quiz generation payload', async () => {
      // Mock question service to return test questions
      const getPracticeSpy = jest.spyOn(QuestionService, 'getPracticeQuestions').mockResolvedValueOnce({
        questions: [
          {
            id: 'test_sec_01',
            question: 'What is the time complexity of binary search?',
            options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'],
            correctOption: 1,
            explanation: 'Binary search halves the search space each step.',
            category: 'dsa',
            topic: 'Algorithms',
            difficulty: 'easy',
            source: 'curated',
            active: true,
            importedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        matchedTopicCount: 1,
        requestedCount: 1
      });

      const res = await request(app)
        .post('/api/quiz/generate')
        .send({
          category: 'dsa',
          topic: 'Algorithms',
          difficulty: 'easy',
          count: 5
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('questions');
      expect(Array.isArray(res.body.questions)).toBe(true);
      expect(res.body.questions.length).toBeGreaterThan(0);

      // Verify that NO question in the response leaks the answer key or explanation
      for (const q of res.body.questions) {
        expect(q).not.toHaveProperty('correctOptionIndex');
        expect(q).not.toHaveProperty('correctOption');
        expect(q).not.toHaveProperty('explanation');
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('questionText');
        expect(q).toHaveProperty('options');
      }

      getPracticeSpy.mockRestore();
    });

    it('should reject client-forged correctAnswers when answers dictionary is omitted', async () => {
      // Create a quiz doc in mock db
      const quizRef = await db.collection('quizzes').add({
        userId: 'test_student_123',
        category: 'dsa',
        difficulty: 'medium',
        questions: [
          {
            id: 'q1',
            questionText: 'Question 1',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 2,
            explanation: 'C is correct'
          }
        ],
        results: null,
        createdAt: new Date().toISOString()
      });

      // Submit omitting answers dictionary but claiming 100% correctAnswers
      const res = await request(app)
        .post(`/api/quiz/${quizRef.id}/submit`)
        .send({
          correctAnswers: 1, // Attempted cheat
          timeSpentSeconds: 30
        });

      expect(res.status).toBe(200);
      // Server-authoritative logic must evaluate to 0 because answers were not submitted
      expect(res.body.results.correctAnswers).toBe(0);
      expect(res.body.results.score).toBe(0);
    });
  });

  describe('3. Admin Authentication & Role Enforcement', () => {
    it('should reject requests with non-admin Supabase token', async () => {
      const res = await request(app)
        .get('/api/admin/questions')
        .set('Authorization', 'Bearer invalid_non_admin_token');

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('4. Mock Database Atomic Operations', () => {
    it('should support runTransaction and batch commits without throwing', async () => {
      const testDocRef = db.collection('test_collection').doc('test_doc');
      
      await db.runTransaction(async (transaction: any) => {
        transaction.set(testDocRef, { count: 1 });
      });

      const snap = await testDocRef.get();
      expect(snap.exists).toBe(true);
      expect(snap.data().count).toBe(1);

      const batch = db.batch();
      batch.update(testDocRef, { count: 2 });
      await batch.commit();

      const snap2 = await testDocRef.get();
      expect(snap2.data().count).toBe(2);
    });
  });

  describe('5. Assessment Review Security & Answer Key Revelation', () => {
    it('should block review access for active unsubmitted assessments', async () => {
      const activeQuizRef = await db.collection('quizzes').add({
        userId: 'student_owner_456',
        category: 'quantitative_aptitude',
        difficulty: 'medium',
        questions: [
          {
            id: 'q_active_1',
            questionText: 'Active question 1',
            options: ['A', 'B', 'C', 'D'],
            correctOptionIndex: 1,
            explanation: 'B is correct because...'
          }
        ],
        results: null, // Active!
        createdAt: new Date().toISOString()
      });

      const res = await request(app).get(`/api/quiz/${activeQuizRef.id}/review`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/cannot review an active assessment/i);
    });

    it('should allow completed assessment review with canonical answers and explanations', async () => {
      const completedQuizRef = await db.collection('quizzes').add({
        userId: 'guest_test_owner',
        category: 'quantitative_aptitude',
        difficulty: 'medium',
        questions: [
          {
            id: 'q_comp_1',
            questionText: 'A trader marks goods 40% above cost price and allows a 15% discount. Gain %?',
            options: ['16%', '18%', '19%', '21%'],
            correctOptionIndex: 2,
            explanation: 'Let CP = 100. MP = 140. SP = 140 * 0.85 = 119. Gain = 19%.'
          }
        ],
        results: {
          score: 100,
          correctAnswers: 1,
          timeTakenSeconds: 25,
          xpEarned: 70,
          coinsEarned: 35
        },
        userAnswers: { '0': 2 },
        createdAt: new Date().toISOString()
      });

      const res = await request(app).get(`/api/quiz/${completedQuizRef.id}/review`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reviewQuestions).toBeDefined();
      expect(res.body.reviewQuestions.length).toBe(1);

      const reviewedQ = res.body.reviewQuestions[0];
      expect(reviewedQ.questionText).toContain('A trader marks goods');
      expect(reviewedQ.correctOptionIndex).toBe(2);
      expect(reviewedQ.correctAnswer).toBe('19%');
      expect(reviewedQ.userAnswerText).toBe('19%');
      expect(reviewedQ.isCorrect).toBe(true);
      expect(reviewedQ.explanation).toContain('Gain = 19%');
    });

    it('should return reviewQuestions in submit response for immediate scorecard review', async () => {
      const submitQuizRef = await db.collection('quizzes').add({
        userId: 'guest_submitter',
        category: 'quantitative_aptitude',
        difficulty: 'medium',
        questions: [
          {
            id: 'q_sub_1',
            questionText: 'Simran profit share question',
            options: ['$12,000', '$13,000', '$14,000', '$15,000'],
            correctOptionIndex: 1,
            explanation: 'Ratio is 1:1, so Simran gets $13,000.'
          }
        ],
        results: null,
        createdAt: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/quiz/${submitQuizRef.id}/submit`)
        .send({
          answers: { '0': 2 }, // User submitted option 2 ($14,000 - incorrect)
          timeSpentSeconds: 40
        });

      expect(res.status).toBe(200);
      expect(res.body.results.correctAnswers).toBe(0);
      expect(res.body.reviewQuestions).toBeDefined();
      expect(res.body.reviewQuestions.length).toBe(1);

      const reviewItem = res.body.reviewQuestions[0];
      expect(reviewItem.isCorrect).toBe(false);
      expect(reviewItem.userAnswerText).toBe('$14,000');
      expect(reviewItem.correctAnswer).toBe('$13,000');
      expect(reviewItem.explanation).toContain('Ratio is 1:1');
    });
  });
});
