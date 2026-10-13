import { create } from 'zustand';

export interface Question {
  id?: string;
  questionText: string;
  options: string[];
  correctOptionIndex?: number;
  correctAnswer?: string;
  correctOptionText?: string;
  explanation?: string;
  userAnswerIndex?: number | null;
  userAnswerText?: string | null;
  isCorrect?: boolean;
}

export interface Quiz {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
  company: string;
  questions: Question[];
  createdAt: string;
}

interface QuizState {
  currentQuiz: Quiz | null;
  currentQuestionIndex: number;
  selectedAnswers: Record<number, number>; // questionIndex -> optionIndex
  timeSpentSeconds: number;
  quizStatus: 'idle' | 'generating' | 'active' | 'finished';
  results: {
    score: number;
    correctAnswers: number;
    timeTakenSeconds: number;
    xpEarned: number;
    coinsEarned: number;
  } | null;
  reviewQuestions: Question[] | null;

  startQuizGeneration: () => void;
  setQuiz: (quiz: Quiz) => void;
  selectOption: (questionIndex: number, optionIndex: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  tickTimer: () => void;
  finishQuiz: (results: NonNullable<QuizState['results']>, reviewQuestions?: Question[]) => void;
  resetQuizState: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  currentQuiz: null,
  currentQuestionIndex: 0,
  selectedAnswers: {},
  timeSpentSeconds: 0,
  quizStatus: 'idle',
  results: null,
  reviewQuestions: null,

  startQuizGeneration: () => set({ 
    quizStatus: 'generating', 
    currentQuiz: null, 
    currentQuestionIndex: 0, 
    selectedAnswers: {}, 
    timeSpentSeconds: 0, 
    results: null,
    reviewQuestions: null
  }),
  setQuiz: (quiz) => set({ currentQuiz: quiz, quizStatus: 'active', reviewQuestions: null }),
  selectOption: (qIndex, oIndex) => set((state) => ({
    selectedAnswers: { ...state.selectedAnswers, [qIndex]: oIndex }
  })),
  nextQuestion: () => set((state) => ({
    currentQuestionIndex: Math.min(state.currentQuestionIndex + 1, (state.currentQuiz?.questions.length || 1) - 1)
  })),
  prevQuestion: () => set((state) => ({
    currentQuestionIndex: Math.max(state.currentQuestionIndex - 1, 0)
  })),
  tickTimer: () => set((state) => ({
    timeSpentSeconds: state.timeSpentSeconds + 1
  })),
  finishQuiz: (results, reviewQuestions) => set((state) => ({
    quizStatus: 'finished',
    results,
    reviewQuestions: reviewQuestions || null,
    currentQuiz: state.currentQuiz && reviewQuestions ? {
      ...state.currentQuiz,
      questions: reviewQuestions
    } : state.currentQuiz
  })),
  resetQuizState: () => set({ 
    currentQuiz: null, 
    currentQuestionIndex: 0, 
    selectedAnswers: {}, 
    timeSpentSeconds: 0, 
    quizStatus: 'idle', 
    results: null,
    reviewQuestions: null
  })
}));
export default useQuizStore;
