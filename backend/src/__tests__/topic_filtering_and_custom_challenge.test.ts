import request from 'supertest';
import { app } from '../index';
import { QuestionService } from '../services/QuestionService';
import AIService from '../services/AIService';
import { SUBJECT_LIST, getTopicsForSubject, isTopicMatch, isSubtopicMatch } from '../constants/subjects';

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
      // Requesting more questions than available for a small topic (Algebra has 2 questions)
      await expect(
        QuestionService.getPracticeQuestions({
          category: 'quantitative_aptitude',
          topic: 'Algebra',
          count: 10
        })
      ).rejects.toThrow(/Not enough questions available/i);

      // Verify HTTP API behavior
      const res = await request(app)
        .post('/api/quiz/generate')
        .send({
          category: 'quantitative_aptitude',
          topic: 'Algebra',
          count: 10
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INSUFFICIENT_QUESTIONS');
      expect(res.body.error).toContain('Not enough questions available');
      // Must not return questions
      expect(res.body.questions).toBeUndefined();
    });

    it('TEST 4B: Exact user scenario - Quantitative Aptitude -> Time and Speed -> Problems on Trains (Medium, count 5)', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'quantitative_aptitude',
        topic: 'Time and Speed',
        subtopic: 'Problems on Trains',
        preferredDifficulty: 'Medium',
        count: 5
      });

      expect(result.questions.length).toBe(5);
      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'Time and Speed')).toBe(true);
        expect(isSubtopicMatch(q.subtopic, 'Problems on Trains')).toBe(true);
        expect(q.difficulty.toLowerCase()).toBe('medium');
      }
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

    it('TEST 7: Custom Room creation persists canonical subject & Top 5 topic without subtopic', async () => {
      const res = await request(app)
        .post('/api/auth/battle-room/create')
        .set('Authorization', 'Bearer user_host_token')
        .send({
          battleType: 'quantitative_aptitude',
          topic: 'Probability',
          questionsCount: 10,
          difficulty: 'Medium',
          timeLimit: 30,
          isPrivate: true
        });

      expect(res.status).toBe(200);
      expect(res.body.room).toBeDefined();
      expect(res.body.room.battleType).toBe('quantitative_aptitude');
      expect(res.body.room.subject).toBe('Quantitative Aptitude');
      expect(res.body.room.settings.topic).toBe('Probability');
      expect(res.body.room.settings.subtopic).toBeUndefined();
      expect(res.body.room.settings.questionsCount).toBe(10);
      expect(res.body.room.settings.difficulty).toBe('Medium');
      expect(res.body.room.settings.timeLimit).toBe(30);

      // Joining player sees identical locked room configuration
      const joinRes = await request(app)
        .post('/api/auth/battle-room/join')
        .set('Authorization', 'Bearer user_guest_token')
        .send({ roomCode: res.body.roomId });

      expect(joinRes.status).toBe(200);
      expect(joinRes.body.room.settings.topic).toBe('Probability');
      expect(joinRes.body.room.settings.difficulty).toBe('Medium');
      expect(joinRes.body.room.settings.questionsCount).toBe(10);
      expect(joinRes.body.room.settings.timeLimit).toBe(30);
    });

    it('TEST 7B: Rejects "All Topics (Mixed)" and invalid cross-subject topics with 400 INVALID_TOPIC', async () => {
      const mixedRes = await request(app)
        .post('/api/auth/battle-room/create')
        .set('Authorization', 'Bearer user_host_token')
        .send({
          battleType: 'quantitative_aptitude',
          topic: 'All Topics (Mixed)',
          questionsCount: 5,
          difficulty: 'Medium',
          timeLimit: 30
        });
      expect(mixedRes.status).toBe(400);
      expect(mixedRes.body.code).toBe('INVALID_TOPIC');

      const invalidRes = await request(app)
        .post('/api/auth/battle-room/create')
        .set('Authorization', 'Bearer user_host_token')
        .send({
          battleType: 'dsa',
          topic: 'Probability',
          questionsCount: 5,
          difficulty: 'Medium',
          timeLimit: 30
        });
      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.code).toBe('INVALID_TOPIC');
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

    it('TEST 10: GET /api/quiz/taxonomy/:slug/topics returns strictly Top 5 Common Topics for Quantitative Aptitude', async () => {
      const res = await request(app).get('/api/quiz/taxonomy/quantitative_aptitude/topics');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.topics)).toBe(true);
      expect(res.body.topics.length).toBe(5);
      expect(res.body.topics).toEqual([
        'Percentage',
        'Profit and Loss',
        'Time and Work',
        'Time, Speed and Distance',
        'Probability'
      ]);
    });

    it('TEST 11: GET /api/quiz/taxonomy/:slug/topics/:topic/subtopics returns subtopics for Time and Speed', async () => {
      const res = await request(app).get('/api/quiz/taxonomy/quantitative_aptitude/topics/Time%20and%20Speed/subtopics');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.subtopics)).toBe(true);
      expect(res.body.subtopics).toContain('Problems on Trains');
    });
  });

  describe('4. Top 5 Topics, Strict Isolation, Counts (5-30), Mixed Difficulty & AI Validation', () => {
    it('TEST 12: Quantitative Aptitude -> Probability yields ONLY Probability questions (no Time and Work)', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'quantitative_aptitude',
        topic: 'Probability',
        preferredDifficulty: 'mixed',
        count: 5
      });

      expect(result.questions.length).toBe(5);
      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'Probability')).toBe(true);
        expect(q.topic.toLowerCase()).not.toContain('time and work');
      }
    });

    it('TEST 13: Quantitative Aptitude -> Time and Work yields ONLY Time and Work questions (no Probability)', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'quantitative_aptitude',
        topic: 'Time and Work',
        preferredDifficulty: 'mixed',
        count: 5
      });

      expect(result.questions.length).toBe(5);
      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'Time and Work')).toBe(true);
        expect(q.topic.toLowerCase()).not.toContain('probability');
      }
    });

    it('TEST 14: DSA -> Arrays and Strings yields ONLY Arrays/Strings questions (no Linked Lists)', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'dsa',
        topic: 'Arrays and Strings',
        preferredDifficulty: 'mixed',
        count: 10
      });

      expect(result.questions.length).toBe(10);
      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'Arrays and Strings')).toBe(true);
        expect(q.topic.toLowerCase()).not.toContain('linked list');
        expect(q.topic.toLowerCase()).not.toContain('tree');
      }
    });

    it('TEST 15: DBMS -> SQL Queries yields ONLY SQL Queries questions', async () => {
      const result = await QuestionService.getPracticeQuestions({
        category: 'dbms',
        topic: 'SQL Queries',
        preferredDifficulty: 'mixed',
        count: 5
      });

      expect(result.questions.length).toBe(5);
      for (const q of result.questions) {
        expect(isTopicMatch(q.topic, 'SQL Queries')).toBe(true);
      }
    });

    it('TEST 16: Every subject has strictly 5 Top Common Topics and C never matches C++', () => {
      for (const sub of SUBJECT_LIST) {
        const topics = getTopicsForSubject(sub.slug);
        expect(topics.length).toBe(5);
      }
      expect(isTopicMatch('C++', 'C')).toBe(false);
      expect(isTopicMatch('C', 'C++')).toBe(false);
      expect(isTopicMatch('C', 'C')).toBe(true);
      expect(isTopicMatch('C++', 'C++')).toBe(true);
    });

    it('TEST 17: Supports 5, 10, 15, 20, and 30 questions with Mixed difficulty', async () => {
      for (const count of [5, 10, 15, 20, 30]) {
        const res = await QuestionService.getPracticeQuestions({
          category: 'quantitative_aptitude',
          topic: 'Time, Speed and Distance',
          preferredDifficulty: 'mixed',
          count
        });
        expect(res.questions.length).toBe(count);
        for (const q of res.questions) {
          expect(isTopicMatch(q.topic, 'Time, Speed and Distance')).toBe(true);
        }
      }
    });

    it('TEST 18: Rejects malformed AI responses and prevents unrelated question insertion', async () => {
      const providerSpy = jest.spyOn(AIService, 'hasConfiguredProvider').mockReturnValue(true);
      const jsonSpy = jest.spyOn(AIService, 'generateJSON').mockResolvedValueOnce([
        {
          // Malformed: missing options and invalid answer
          subject: 'Programming',
          topic: 'Python',
          difficulty: 'Medium',
          question: '',
          options: ['Only one'],
          correctAnswer: 'Missing',
          explanation: ''
        },
        {
          // Valid Python question
          subject: 'Programming',
          topic: 'Python',
          difficulty: 'Medium',
          question: 'What is the output of len([1, 2, 3]) in Python?',
          options: ['2', '3', '4', 'Error'],
          correctAnswer: '3',
          explanation: 'len() returns the number of items in the list, which is 3.'
        }
      ]);

      const validated = await QuestionService.generateValidatedAIQuestions({
        subjectSlug: 'programming',
        subjectName: 'Programming',
        topic: 'Python',
        difficulty: 'medium',
        count: 2,
        existingHashes: new Set<string>()
      });

      // Only the 1 valid question survives; malformed item is rejected
      expect(validated.length).toBe(1);
      expect(validated[0].topic).toBe('Python');
      expect(validated[0].correctOption).toBe(1);

      providerSpy.mockRestore();
      jsonSpy.mockRestore();
    });
  });
});
