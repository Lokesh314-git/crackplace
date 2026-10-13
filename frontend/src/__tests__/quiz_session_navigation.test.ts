import { describe, it, expect, beforeEach } from 'vitest';
import { useQuizStore } from '../store/quizStore';

describe('Quiz Session and Subject Navigation State Management', () => {
  beforeEach(() => {
    useQuizStore.getState().resetQuizState();
  });

  it('1. Initializes in clean idle state', () => {
    const state = useQuizStore.getState();
    expect(state.quizStatus).toBe('idle');
    expect(state.currentQuiz).toBeNull();
    expect(state.results).toBeNull();
    expect(state.reviewQuestions).toBeNull();
    expect(state.activeAttemptId).toBeNull();
    expect(state.activeCategory).toBeNull();
  });

  it('2. Completes an assessment for Subject A and holds scorecard in memory', () => {
    const quizA = {
      id: 'quiz_attempt_cn_101',
      category: 'computer_networks',
      difficulty: 'medium' as const,
      language: 'English',
      company: 'General',
      questions: [
        {
          id: 'q1',
          questionText: 'What layer is IP?',
          options: ['Network', 'Transport', 'Data Link', 'Physical'],
          correctOptionIndex: 0
        }
      ],
      createdAt: new Date().toISOString()
    };

    // Start and load Quiz A
    useQuizStore.getState().setQuiz(quizA);
    expect(useQuizStore.getState().quizStatus).toBe('active');
    expect(useQuizStore.getState().activeAttemptId).toBe('quiz_attempt_cn_101');
    expect(useQuizStore.getState().activeCategory).toBe('computer_networks');

    // Finish Quiz A
    const resultsA = {
      score: 100,
      correctAnswers: 1,
      timeTakenSeconds: 30,
      xpEarned: 70,
      coinsEarned: 35
    };
    useQuizStore.getState().finishQuiz(resultsA, quizA.questions);

    const finishedState = useQuizStore.getState();
    expect(finishedState.quizStatus).toBe('finished');
    expect(finishedState.results).toEqual(resultsA);
    expect(finishedState.currentQuiz?.id).toBe('quiz_attempt_cn_101');
    expect(finishedState.currentQuiz?.category).toBe('computer_networks');
  });

  it('3. Resets transient state completely when returning to Practice Hub', () => {
    // Simulate finished quiz in store
    useQuizStore.setState({
      quizStatus: 'finished',
      results: { score: 90, correctAnswers: 9, timeTakenSeconds: 60, xpEarned: 50, coinsEarned: 25 },
      activeAttemptId: 'quiz_old_999',
      activeCategory: 'computer_networks',
      currentQuiz: {
        id: 'quiz_old_999',
        category: 'computer_networks',
        difficulty: 'medium',
        language: 'English',
        company: 'General',
        questions: [],
        createdAt: ''
      }
    });

    // User navigates back to Practice Hub
    useQuizStore.getState().resetQuizState();

    const resetState = useQuizStore.getState();
    expect(resetState.quizStatus).toBe('idle');
    expect(resetState.results).toBeNull();
    expect(resetState.currentQuiz).toBeNull();
    expect(resetState.reviewQuestions).toBeNull();
    expect(resetState.activeAttemptId).toBeNull();
    expect(resetState.activeCategory).toBeNull();
  });

  it('4. Selecting a different subject purges previous completed scorecard and initializes new subject', () => {
    // User had finished Computer Networks quiz
    useQuizStore.setState({
      quizStatus: 'finished',
      results: { score: 80, correctAnswers: 4, timeTakenSeconds: 120, xpEarned: 40, coinsEarned: 20 },
      activeAttemptId: 'quiz_cn_done',
      activeCategory: 'computer_networks',
      currentQuiz: {
        id: 'quiz_cn_done',
        category: 'computer_networks',
        difficulty: 'medium',
        language: 'English',
        company: 'General',
        questions: [],
        createdAt: ''
      }
    });

    // User clicks Quantitative Aptitude to start a new session
    useQuizStore.getState().initializeSubjectSession('quantitative_aptitude');

    const newState = useQuizStore.getState();
    // Must NOT be finished, must NOT have old scorecard results
    expect(newState.quizStatus).toBe('idle');
    expect(newState.results).toBeNull();
    expect(newState.currentQuiz).toBeNull();
    expect(newState.reviewQuestions).toBeNull();
    expect(newState.activeAttemptId).toBeNull();
    expect(newState.activeCategory).toBe('quantitative_aptitude');
  });

  it('5. Preserves active in-progress attempt if the user remains on the same subject', () => {
    const inProgressQuiz = {
      id: 'quiz_dsa_active',
      category: 'dsa',
      difficulty: 'hard' as const,
      language: 'English',
      company: 'General',
      questions: [{ questionText: 'Q1', options: ['A', 'B'] }],
      createdAt: ''
    };

    useQuizStore.getState().setQuiz(inProgressQuiz);
    useQuizStore.getState().selectOption(0, 1);

    expect(useQuizStore.getState().quizStatus).toBe('active');
    expect(useQuizStore.getState().selectedAnswers[0]).toBe(1);

    // Initializing same category while active should preserve in-progress state
    useQuizStore.getState().initializeSubjectSession('dsa');

    const state = useQuizStore.getState();
    expect(state.quizStatus).toBe('active');
    expect(state.currentQuiz?.id).toBe('quiz_dsa_active');
    expect(state.selectedAnswers[0]).toBe(1);
  });

  it('6. Ensures a new attempt receives a fresh unique attempt ID upon start', () => {
    const attempt1 = {
      id: 'attempt_1_uuid',
      category: 'operating_systems',
      difficulty: 'easy' as const,
      language: 'English',
      company: 'General',
      questions: [],
      createdAt: ''
    };
    useQuizStore.getState().setQuiz(attempt1);
    expect(useQuizStore.getState().activeAttemptId).toBe('attempt_1_uuid');

    // Clear for new attempt
    useQuizStore.getState().resetQuizState();

    const attempt2 = {
      id: 'attempt_2_uuid',
      category: 'operating_systems',
      difficulty: 'easy' as const,
      language: 'English',
      company: 'General',
      questions: [],
      createdAt: ''
    };
    useQuizStore.getState().setQuiz(attempt2);
    expect(useQuizStore.getState().activeAttemptId).toBe('attempt_2_uuid');
    expect(useQuizStore.getState().activeAttemptId).not.toBe(attempt1.id);
  });
});
