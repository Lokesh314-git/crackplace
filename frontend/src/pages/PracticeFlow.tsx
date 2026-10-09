import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuizStore } from '../store/quizStore';
import { useAuthStore } from '../store/authStore';
import { 
  FaBrain, 
  FaCode, 
  FaDatabase, 
  FaServer,
  FaNetworkWired,
  FaFont,
  FaComments,
  FaCalculator, 
  FaClock, 
  FaCoins, 
  FaAward,
  FaChevronRight,
  FaChevronLeft
} from 'react-icons/fa6';
import { Card, Badge, Button, ProgressBar } from '../components/ui';
import { SUBJECT_LIST, normalizeSubjectSlug } from '../constants/subjects';

import { questionService } from '../services/questionService';

const ICON_MAP: Record<string, React.ReactNode> = {
  FaCalculator: <FaCalculator className="w-4 h-4" />,
  FaCode: <FaCode className="w-4 h-4" />,
  FaDatabase: <FaDatabase className="w-4 h-4" />,
  FaServer: <FaServer className="w-4 h-4" />,
  FaNetworkWired: <FaNetworkWired className="w-4 h-4" />,
  FaBrain: <FaBrain className="w-4 h-4" />,
  FaFont: <FaFont className="w-4 h-4" />,
  FaComments: <FaComments className="w-4 h-4" />
};

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const COUNTS = [5, 10, 15, 20];


export const PracticeFlow: React.FC = () => {
  const { subject } = useParams();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const {
    currentQuiz,
    currentQuestionIndex,
    selectedAnswers,
    timeSpentSeconds,
    quizStatus,
    results,
    startQuizGeneration,
    setQuiz,
    selectOption,
    nextQuestion,
    prevQuestion,
    tickTimer,
    finishQuiz,
    resetQuizState
  } = useQuizStore();

  const selectedCategory = normalizeSubjectSlug(subject || 'quantitative_aptitude');
  const subjectConfig = SUBJECT_LIST.find(s => s.slug === selectedCategory) || SUBJECT_LIST[0];
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [selectedCount, setSelectedCount] = useState(5);
  // Local UI status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  // Load available topics whenever category changes
  useEffect(() => {
    let isMounted = true;
    questionService.getTopics(selectedCategory).then((topics) => {
      if (isMounted) {
        setAvailableTopics(topics);
        setSelectedTopic('All');
      }
    });
    return () => { isMounted = false; };
  }, [selectedCategory]);


  // Quiz active timer
  useEffect(() => {
    let timer: any;
    if (quizStatus === 'active') {
      timer = setInterval(() => {
        tickTimer();
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [quizStatus, tickTimer]);

  // Start Generation call using Supabase Question Bank
  const handleLaunchQuiz = async () => {
    startQuizGeneration();
    setErrorMessage(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          category: selectedCategory,
          topic: selectedTopic !== 'All' ? selectedTopic : undefined,
          difficulty: selectedDifficulty,
          count: selectedCount,
          
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Question bank is currently unavailable. Please try again.');
      }

      const data = await response.json();
      if (!data.quiz || !data.quiz.questions || data.quiz.questions.length === 0) {
        throw new Error('No questions found matching your filter criteria. Please choose another topic or difficulty.');
      }

      setQuiz(data.quiz);
    } catch (err: any) {
      console.error('[Quiz] Question launch error:', err);
      setErrorMessage(err.message || 'Unable to load questions from Question Bank. Please try again.');
      resetQuizState();
    }
  };

  // Submit assessment
  const handleSubmitQuiz = async () => {
    if (!currentQuiz) return;
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/quiz/${currentQuiz.id}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          answers: selectedAnswers,
          timeSpentSeconds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to evaluate assessment submission');
      }

      const data = await response.json();
      finishQuiz(data.results);
      // Relying on authStore onSnapshot for userProfile state sync from backend transaction
    } catch (err: any) {
      console.error('[Quiz] Submit error:', err);
      alert('Error submitting quiz: ' + err.message);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // State 1: Configuration View
  if (quizStatus === 'idle') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/practice" className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1 w-max">
          &larr; Back to Practice Hub
        </Link>
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-blue-600">
              {ICON_MAP[subjectConfig.iconName] || <FaCode className="w-5 h-5" />}
            </span>
            <Badge variant="primary" size="sm">
              {subjectConfig.badge}
            </Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mt-2">
            {subjectConfig.name}
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Customize your practice session. Questions are curated from the centralized CrackPlace Question Bank.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {errorMessage}
          </div>
        )}

        <Card>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Topic Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Topic</label>
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="All">All Topics</option>
                  {availableTopics.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Difficulty */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Difficulty</label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  {DIFFICULTIES.map(diff => (
                    <option key={diff} value={diff} className="capitalize">{diff}</option>
                  ))}
                </select>
              </div>

              {/* Count */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Questions</label>
                <select
                  value={selectedCount}
                  onChange={(e) => setSelectedCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  {COUNTS.map(count => (
                    <option key={count} value={count}>{count} Questions</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleLaunchQuiz}
                className="w-full"
              >
                Start Practice
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // State 2: Loader View
  if (quizStatus === 'generating') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 text-center">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">Loading Supabase Questions</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Retrieving authenticated questions for {selectedCategory} ({selectedDifficulty} tier)...
          </p>
        </div>
      </div>
    );
  }

  // State 3: Active Quiz Workspace
  if (quizStatus === 'active' && currentQuiz) {
    const questions = currentQuiz.questions;
    const currentQuestion = questions[currentQuestionIndex];

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              {currentQuiz.category}
            </Badge>
            <Badge variant="neutral" size="sm" className="capitalize">
              {currentQuiz.difficulty}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 font-mono text-xs font-semibold text-slate-800 shadow-xs">
            <FaClock className="w-3.5 h-3.5 text-blue-600" />
            <span>{formatTime(timeSpentSeconds)}</span>
          </div>
        </div>

        {/* Progress */}
        <ProgressBar
          value={currentQuestionIndex + 1}
          max={questions.length}
          label={`Question ${currentQuestionIndex + 1} of ${questions.length}`}
          color="blue"
          size="sm"
          showPercentage
        />

        {/* Question & Option Card */}
        <Card>
          <div className="space-y-6">
            <p className="text-base font-medium text-slate-900 leading-relaxed">
              {currentQuestion.questionText}
            </p>

            <div className="space-y-2.5">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedAnswers[currentQuestionIndex] === idx;
                const prefix = String.fromCharCode(65 + idx); // A, B, C, D
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => selectOption(currentQuestionIndex, idx)}
                    className={`w-full p-3.5 rounded-lg border text-left text-xs md:text-sm font-medium transition-all flex items-center justify-between gap-3 cursor-pointer
                      ${isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0
                        ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {prefix}
                      </span>
                      <span>{opt}</span>
                    </div>

                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] shrink-0
                      ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                      {isSelected ? '✓' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Navigation Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prevQuestion}
            disabled={currentQuestionIndex === 0}
            leftIcon={<FaChevronLeft className="w-3 h-3" />}
          >
            Previous
          </Button>

          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={nextQuestion}
              rightIcon={<FaChevronRight className="w-3 h-3" />}
            >
              Next Question
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitQuiz}
              className="!bg-emerald-600 hover:!bg-emerald-700"
            >
              Submit Assessment
            </Button>
          )}
        </div>
      </div>
    );
  }

  // State 4: Scoreboard Results
  if (quizStatus === 'finished' && results && currentQuiz) {
    const isPassing = results.score >= 60;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <Badge variant={isPassing ? 'success' : 'warning'} size="md">
            Assessment Completed
          </Badge>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
            Assessment Scorecard
          </h1>
          <p className="text-xs text-slate-500">
            {currentQuiz.category} • Completed in {formatTime(results.timeTakenSeconds || 0)}
          </p>
        </div>

        {/* Results Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="text-center py-6">
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">Score</p>
            <p className={`text-3xl font-bold mt-2 ${isPassing ? 'text-emerald-600' : 'text-amber-600'}`}>
              {results.score}%
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {results.correctAnswers} of {currentQuiz.questions.length} Correct
            </p>
          </Card>

          <Card className="text-center py-6">
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">XP Earned</p>
            <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-purple-600 mt-2">
              <FaAward className="w-5 h-5" />
              <span>+{results.xpEarned}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Progression XP</p>
          </Card>

          <Card className="text-center py-6">
            <p className="text-xs uppercase font-bold text-slate-500 tracking-wider">Coins Awarded</p>
            <div className="flex items-center justify-center gap-1.5 text-2xl font-bold text-amber-600 mt-2">
              <FaCoins className="w-5 h-5" />
              <span>+{results.coinsEarned}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Armory Currency</p>
          </Card>
        </div>

        {/* Answer Review Sheet */}
        <Card
          header={
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Detailed Question Review
            </h3>
          }
        >
          <div className="space-y-4">
            {currentQuiz.questions.map((q, idx) => {
              const selectedIdx = selectedAnswers[idx];
              const isCorrect = selectedIdx === q.correctOptionIndex;

              return (
                <div key={idx} className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {idx + 1}. {q.questionText}
                    </p>
                    <Badge variant={isCorrect ? 'success' : 'error'} size="sm" className="shrink-0">
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-slate-700 pt-1">
                    <p>
                      Your Answer: <strong className={isCorrect ? 'text-emerald-700' : 'text-red-700'}>
                        {selectedIdx !== undefined ? q.options[selectedIdx] : 'Unanswered'}
                      </strong>
                    </p>
                    {!isCorrect && (
                      <p>
                        Correct Answer: <strong className="text-emerald-700">{q.options[q.correctOptionIndex]}</strong>
                      </p>
                    )}
                  </div>

                  {q.explanation && (
                    <div className="p-2.5 rounded bg-white border border-slate-200 text-slate-600 text-[11px] leading-relaxed mt-2">
                      <strong className="text-slate-800">Explanation: </strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Bottom CTAs */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="md" onClick={() => navigate('/practice')}>
            Back to Practice Hub
          </Button>
          <Button variant="primary" size="md" onClick={handleLaunchQuiz}>
            Retake Assessment
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default PracticeFlow;

