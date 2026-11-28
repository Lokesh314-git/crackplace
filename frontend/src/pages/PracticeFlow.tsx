import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
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
  FaChevronLeft,
  FaTerminal,
  FaCubes,
  FaLaptopCode,
  FaPercent,
  FaChartLine,
  FaBriefcase,
  FaGaugeHigh,
  FaDice,
  FaArrowUp19,
  FaKey,
  FaUsers,
  FaChair,
  FaDiagramProject,
  FaBookOpen,
  FaPenNib,
  FaSpellCheck,
  FaListOl,
  FaMagnifyingGlass,
  FaLayerGroup,
  FaLink,
  FaBarsStaggered,
  FaSitemap,
  FaArrowDownShortWide,
  FaTableColumns,
  FaCodeMerge,
  FaShieldHalved,
  FaBolt,
  FaMicrochip,
  FaMemory,
  FaLock,
  FaArrowsRotate,
  FaGlobe,
  FaRightLeft,
  FaRoute,
  FaBoxArchive,
  FaShapes,
  FaEyeSlash,
  FaWrench,
  FaStar,
  FaHandshake,
  FaScaleBalanced,
  FaCompass,
  FaCheck,
  FaPython,
  FaJava,
  FaJs,
  FaHtml5,
  FaReact,
  FaNodeJs
} from 'react-icons/fa6';
import { Card, Badge, Button, ProgressBar } from '../components/ui';
import { SUBJECT_LIST, normalizeSubjectSlug, getTopicObjectsForSubject } from '../constants/subjects';
import type { TopicTaxonomy } from '../constants/subjects';

const ICON_MAP: Record<string, React.ReactNode> = {
  FaCalculator: <FaCalculator className="w-4 h-4" />,
  FaCode: <FaCode className="w-4 h-4" />,
  FaDatabase: <FaDatabase className="w-4 h-4" />,
  FaServer: <FaServer className="w-4 h-4" />,
  FaNetworkWired: <FaNetworkWired className="w-4 h-4" />,
  FaBrain: <FaBrain className="w-4 h-4" />,
  FaFont: <FaFont className="w-4 h-4" />,
  FaComments: <FaComments className="w-4 h-4" />,
  FaTerminal: <FaTerminal className="w-4 h-4" />,
  FaCubes: <FaCubes className="w-4 h-4" />,
  FaLaptopCode: <FaLaptopCode className="w-4 h-4" />,
  FaPercent: <FaPercent className="w-4 h-4" />,
  FaChartLine: <FaChartLine className="w-4 h-4" />,
  FaBriefcase: <FaBriefcase className="w-4 h-4" />,
  FaGaugeHigh: <FaGaugeHigh className="w-4 h-4" />,
  FaDice: <FaDice className="w-4 h-4" />,
  FaArrowUp19: <FaArrowUp19 className="w-4 h-4" />,
  FaKey: <FaKey className="w-4 h-4" />,
  FaUsers: <FaUsers className="w-4 h-4" />,
  FaChair: <FaChair className="w-4 h-4" />,
  FaDiagramProject: <FaDiagramProject className="w-4 h-4" />,
  FaBookOpen: <FaBookOpen className="w-4 h-4" />,
  FaPenNib: <FaPenNib className="w-4 h-4" />,
  FaSpellCheck: <FaSpellCheck className="w-4 h-4" />,
  FaListOl: <FaListOl className="w-4 h-4" />,
  FaMagnifyingGlass: <FaMagnifyingGlass className="w-4 h-4" />,
  FaLayerGroup: <FaLayerGroup className="w-4 h-4" />,
  FaLink: <FaLink className="w-4 h-4" />,
  FaBarsStaggered: <FaBarsStaggered className="w-4 h-4" />,
  FaSitemap: <FaSitemap className="w-4 h-4" />,
  FaArrowDownShortWide: <FaArrowDownShortWide className="w-4 h-4" />,
  FaTableColumns: <FaTableColumns className="w-4 h-4" />,
  FaCodeMerge: <FaCodeMerge className="w-4 h-4" />,
  FaShieldHalved: <FaShieldHalved className="w-4 h-4" />,
  FaBolt: <FaBolt className="w-4 h-4" />,
  FaMicrochip: <FaMicrochip className="w-4 h-4" />,
  FaClock: <FaClock className="w-4 h-4" />,
  FaMemory: <FaMemory className="w-4 h-4" />,
  FaLock: <FaLock className="w-4 h-4" />,
  FaArrowsRotate: <FaArrowsRotate className="w-4 h-4" />,
  FaGlobe: <FaGlobe className="w-4 h-4" />,
  FaRightLeft: <FaRightLeft className="w-4 h-4" />,
  FaRoute: <FaRoute className="w-4 h-4" />,
  FaBoxArchive: <FaBoxArchive className="w-4 h-4" />,
  FaShapes: <FaShapes className="w-4 h-4" />,
  FaEyeSlash: <FaEyeSlash className="w-4 h-4" />,
  FaWrench: <FaWrench className="w-4 h-4" />,
  FaStar: <FaStar className="w-4 h-4" />,
  FaHandshake: <FaHandshake className="w-4 h-4" />,
  FaScaleBalanced: <FaScaleBalanced className="w-4 h-4" />,
  FaCompass: <FaCompass className="w-4 h-4" />,
  FaPython: <FaPython className="w-4 h-4" />,
  FaJava: <FaJava className="w-4 h-4" />,
  FaJs: <FaJs className="w-4 h-4" />,
  FaHtml5: <FaHtml5 className="w-4 h-4" />,
  FaReact: <FaReact className="w-4 h-4" />,
  FaNodeJs: <FaNodeJs className="w-4 h-4" />
};

const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const;
const COUNTS = [5, 10, 15, 20, 30];


export const PracticeFlow: React.FC = () => {
  const { subject } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewId = searchParams.get('review');
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const {
    currentQuiz,
    currentQuestionIndex,
    selectedAnswers,
    timeSpentSeconds,
    quizStatus,
    results,
    reviewQuestions,
    startQuizGeneration,
    setQuiz,
    selectOption,
    nextQuestion,
    prevQuestion,
    tickTimer,
    finishQuiz,
    resetQuizState,
    initializeSubjectSession
  } = useQuizStore();

  const selectedCategory = normalizeSubjectSlug(subject || 'quantitative_aptitude');
  const subjectConfig = SUBJECT_LIST.find(s => s.slug === selectedCategory) || SUBJECT_LIST[0];
  const topTopics: TopicTaxonomy[] = getTopicObjectsForSubject(selectedCategory);

  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [selectedCount, setSelectedCount] = useState(5);
  const [selectedQuestionType, setSelectedQuestionType] = useState<'mcq' | 'coding'>('mcq');
  // Local UI status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const activeLaunchRef = useRef<AbortController | null>(null);

  // Synchronize subject session state with route parameters
  useEffect(() => {
    // If a specific completed assessment review is requested via query param (?review=quizId), let review loader handle it
    if (reviewId) return;

    // When navigating to a subject without reviewId, initialize a clean session for this subject
    // This clears any previous assessment's scorecard or stale state from another subject
    initializeSubjectSession(selectedCategory);
    setSelectedTopic(null);
    setSelectedQuestionType('mcq');
    setErrorMessage(null);
  }, [selectedCategory, reviewId, initializeSubjectSession]);

  // Clean up any pending launch request on unmount or category change
  useEffect(() => {
    return () => {
      if (activeLaunchRef.current) {
        activeLaunchRef.current.abort();
      }
    };
  }, [selectedCategory]);

  // Load past completed assessment for review if review query param is present
  useEffect(() => {
    if (!reviewId) return;

    // If store already has this exact completed attempt loaded and finished, skip redundant fetch
    if (quizStatus === 'finished' && currentQuiz?.id === reviewId && results) {
      return;
    }

    let isMounted = true;
    const fetchReview = async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/quiz/${reviewId}/review`, { headers });
        if (!res.ok) throw new Error('Could not load assessment review');
        const data = await res.json();
        if (isMounted) {
          const loadedQuestions = data.reviewQuestions || data.questions || [];
          setQuiz({
            id: data.quizId || reviewId,
            category: data.category,
            difficulty: data.difficulty,
            language: 'English',
            company: 'General',
            questions: loadedQuestions,
            createdAt: data.createdAt
          });
          if (data.userAnswers) {
            Object.entries(data.userAnswers).forEach(([k, v]) => {
              selectOption(Number(k), Number(v));
            });
          }
          finishQuiz(data.results, loadedQuestions);
        }
      } catch (err: any) {
        console.error('Failed to load review:', err);
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load assessment review');
          resetQuizState();
        }
      }
    };
    fetchReview();
    return () => { isMounted = false; };
  }, [reviewId, token]);

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

  const handleSelectTopic = (topicName: string) => {
    if (activeLaunchRef.current) {
      activeLaunchRef.current.abort();
      activeLaunchRef.current = null;
    }
    setSelectedTopic(topicName);
    setErrorMessage(null);
  };

  // Start Generation call using Supabase Question Bank + AI validation
  const handleLaunchQuiz = async () => {
    if (!selectedTopic) return;

    if (activeLaunchRef.current) {
      activeLaunchRef.current.abort();
    }
    const abortController = new AbortController();
    activeLaunchRef.current = abortController;

    const launchCategory = selectedCategory;
    const launchTopic = selectedTopic;
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
        signal: abortController.signal,
        body: JSON.stringify({
          category: selectedCategory,
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          questionType: subjectConfig.supportsCoding ? selectedQuestionType : 'mcq',
          count: selectedCount
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

      // Stale response guard: discard if user changed subject or topic while fetch was inflight
      if (selectedCategory !== launchCategory || selectedTopic !== launchTopic) {
        return;
      }

      setQuiz(data.quiz);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[Quiz] Question launch error:', err);
      setErrorMessage(err.message || 'Unable to load questions from Question Bank. Please try again.');
      resetQuizState();
    } finally {
      if (activeLaunchRef.current === abortController) {
        activeLaunchRef.current = null;
      }
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
      finishQuiz(data.results, data.reviewQuestions);
      if (data.profile) {
        useAuthStore.setState({ userProfile: data.profile });
      }
      // Synchronize URL with ?review=${currentQuiz.id} so browser refresh directly restores this scorecard
      setSearchParams({ review: currentQuiz.id }, { replace: true });
    } catch (err: any) {
      console.error('[Quiz] Submit error:', err);
      alert('Error submitting quiz: ' + err.message);
    }
  };

  const handleBackToHub = () => {
    resetQuizState();
    navigate('/practice');
  };

  const handleRetakeAssessment = () => {
    setSearchParams({}, { replace: true });
    resetQuizState();
    handleLaunchQuiz();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // State 1: Configuration View
  if (quizStatus === 'idle') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Link 
          to="/practice" 
          onClick={handleBackToHub}
          className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1 w-max"
        >
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
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight mt-2">
            {subjectConfig.name}
          </h1>
          <p className="text-sm text-text-secondary max-w-2xl">
            Select one of the top 5 placement topics below, configure your session, and generate verified practice questions.
          </p>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-2">
            <p className="font-medium">{errorMessage}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedDifficulty !== 'mixed' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDifficulty('mixed');
                    setErrorMessage(null);
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Switch to Mixed Difficulty
                </button>
              )}
              {selectedCount > 5 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCount(5);
                    setErrorMessage(null);
                  }}
                  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Reduce to 5 Questions
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedDifficulty('medium');
                  setSelectedCount(5);
                  setErrorMessage(null);
                }}
                className="px-2.5 py-1 rounded bg-bg-surface border border-amber-500/30 hover:bg-amber-500/10 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Reset Configuration
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Top 5 Common Topics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              1. Choose a Topic (Top 5 Placement Topics)
            </h2>
            {selectedTopic && (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Selected: {selectedTopic}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topTopics.map((topicObj) => {
              const isSelected = selectedTopic === topicObj.name;
              return (
                <button
                  key={topicObj.name}
                  type="button"
                  onClick={() => handleSelectTopic(topicObj.name)}
                  className={`p-4 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between gap-3 cursor-pointer relative ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600/10 ring-2 ring-blue-600/30 shadow-sm'
                      : 'border-border-subtle bg-bg-surface hover:border-blue-500/50 hover:bg-bg-elevated/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className={`p-2.5 rounded-lg border shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-bg-elevated text-blue-600 dark:text-blue-400 border-border-subtle'
                    }`}>
                      {ICON_MAP[topicObj.iconName] || <FaCode className="w-4 h-4" />}
                    </div>

                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-border-subtle bg-bg-elevated/50'
                    }`}>
                      {isSelected && <FaCheck className="w-2.5 h-2.5" />}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className={`text-sm font-bold leading-snug ${
                      isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-text-primary'
                    }`}>
                      {topicObj.name}
                    </h3>
                    <p className="text-xs text-text-muted leading-relaxed line-clamp-2">
                      {topicObj.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Quiz Configuration */}
        <Card>
          <div className="space-y-5">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              2. Configure Quiz
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Number of Questions */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary block">
                  Number of Questions
                </label>
                <div className="flex flex-wrap gap-2">
                  {COUNTS.map(count => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setSelectedCount(count)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        selectedCount === count
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-blue-500/50'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary block">
                  Difficulty Level
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map(diff => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setSelectedDifficulty(diff)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold capitalize border transition-all cursor-pointer ${
                        selectedDifficulty === diff
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-blue-500/50'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Question Type (Only where applicable) */}
            {subjectConfig.supportsCoding && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-text-secondary block">
                  Question Type
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionType('mcq')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      selectedQuestionType === 'mcq'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-blue-500/50'
                    }`}
                  >
                    Multiple Choice Questions (MCQ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionType('coding')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      selectedQuestionType === 'coding'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-bg-elevated text-text-secondary border-border-subtle hover:border-blue-500/50'
                    }`}
                  >
                    Coding Questions
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleLaunchQuiz}
                disabled={!selectedTopic}
                className="w-full"
              >
                {selectedTopic ? `Generate Questions (${selectedTopic})` : 'Select a Topic to Continue'}
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
          <h3 className="text-base font-bold text-text-primary">Generating {selectedTopic} Questions</h3>
          <p className="text-xs text-text-muted max-w-sm">
            Validating {selectedCount} {selectedDifficulty} question(s) for {subjectConfig.name} — {selectedTopic}...
          </p>
        </div>
      </div>
    );
  }

  // State 3: Active Quiz Workspace
  if (quizStatus === 'active' && currentQuiz) {
    if (normalizeSubjectSlug(currentQuiz.category) !== selectedCategory) {
      return (
        <div className="max-w-md mx-auto my-12 p-6 rounded-xl border border-slate-200 bg-white text-center space-y-4 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Active Quiz in Progress</h2>
          <p className="text-xs text-slate-600">
            You currently have an in-progress session in <span className="font-semibold text-blue-600">{currentQuiz.category}</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetQuizState();
                initializeSubjectSession(selectedCategory);
              }}
              className="flex-1"
            >
              Discard & Start Here
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/practice/${encodeURIComponent(normalizeSubjectSlug(currentQuiz.category))}`)}
              className="flex-1"
            >
              Resume Quiz
            </Button>
          </div>
        </div>
      );
    }
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
  if (quizStatus === 'finished' && results && (currentQuiz || (reviewQuestions && reviewQuestions.length > 0))) {
    const activeCat = currentQuiz?.category || selectedCategory;
    if (normalizeSubjectSlug(activeCat) !== selectedCategory) {
      return null;
    }
    const isPassing = results.score >= 60;
    const questionsToDisplay = (reviewQuestions && reviewQuestions.length > 0)
      ? reviewQuestions
      : (currentQuiz?.questions || []);
    const totalQuestionsCount = questionsToDisplay.length || currentQuiz?.questions.length || 5;

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
            {subjectConfig.name} • Completed in {formatTime(results.timeTakenSeconds || 0)}
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
              {results.correctAnswers} of {totalQuestionsCount} Correct
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
            {questionsToDisplay.map((q, idx) => {
              const selectedIdx = selectedAnswers[idx] ?? q.userAnswerIndex;
              const hasAnswered = selectedIdx !== undefined && selectedIdx !== null && selectedIdx >= 0;

              // Resolve 0-based correct option index across variations
              const correctIdx = typeof q.correctOptionIndex === 'number'
                ? q.correctOptionIndex
                : typeof q.correctOption === 'number'
                ? q.correctOption
                : (typeof (q as any).correct_option === 'number' ? (q as any).correct_option : undefined);

              // Correct Answer text resolution
              let displayCorrectAnswer = '';
              if (q.correctOptionText && typeof q.correctOptionText === 'string' && q.correctOptionText.trim().length > 0) {
                displayCorrectAnswer = q.correctOptionText.trim();
              } else if (q.correctAnswer && typeof q.correctAnswer === 'string' && q.correctAnswer.trim().length > 0) {
                const trimmed = q.correctAnswer.trim();
                if (['A', 'B', 'C', 'D'].includes(trimmed.toUpperCase()) && q.options && q.options[trimmed.toUpperCase().charCodeAt(0) - 65]) {
                  displayCorrectAnswer = q.options[trimmed.toUpperCase().charCodeAt(0) - 65];
                } else {
                  displayCorrectAnswer = trimmed;
                }
              } else if (q.options && typeof correctIdx === 'number' && q.options[correctIdx]) {
                displayCorrectAnswer = q.options[correctIdx];
              } else if ((q as any).correct_answer && typeof (q as any).correct_answer === 'string') {
                const rawAns = (q as any).correct_answer.trim();
                if (['A', 'B', 'C', 'D'].includes(rawAns.toUpperCase()) && q.options && q.options[rawAns.toUpperCase().charCodeAt(0) - 65]) {
                  displayCorrectAnswer = q.options[rawAns.toUpperCase().charCodeAt(0) - 65];
                } else {
                  displayCorrectAnswer = rawAns;
                }
              }

              // User Answer text resolution
              let displayUserAnswer = 'Not answered';
              if (hasAnswered) {
                if (q.userAnswerText && typeof q.userAnswerText === 'string' && q.userAnswerText.trim().length > 0) {
                  displayUserAnswer = q.userAnswerText;
                } else if (q.options && typeof selectedIdx === 'number' && q.options[selectedIdx]) {
                  displayUserAnswer = q.options[selectedIdx];
                } else {
                  displayUserAnswer = `Option ${Number(selectedIdx) + 1}`;
                }
              }

              const isCorrect = q.isCorrect !== undefined
                ? q.isCorrect
                : (hasAnswered && (
                    (typeof correctIdx === 'number' && selectedIdx === correctIdx) ||
                    (Boolean(displayCorrectAnswer) && displayCorrectAnswer.toLowerCase().trim() === displayUserAnswer.toLowerCase().trim())
                  ));

              // Explanation resolution
              let explanationText = '';
              if (q.explanation && typeof q.explanation === 'string' && q.explanation.trim().length > 0 && q.explanation.trim() !== 'Explanation not available for this question yet') {
                explanationText = q.explanation.trim();
              } else if ((q as any).solution && typeof (q as any).solution === 'string' && (q as any).solution.trim().length > 0) {
                explanationText = (q as any).solution.trim();
              } else if ((q as any).answer_explanation && typeof (q as any).answer_explanation === 'string' && (q as any).answer_explanation.trim().length > 0) {
                explanationText = (q as any).answer_explanation.trim();
              } else if (displayCorrectAnswer) {
                explanationText = `The correct answer is "${displayCorrectAnswer}". This follows placement assessment standards for ${subjectConfig.name}.`;
              } else {
                explanationText = `Explanation for this question is currently being reviewed in the central Question Bank.`;
              }

              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900 leading-relaxed text-sm">
                      {idx + 1}. {q.questionText}
                    </p>
                    <Badge variant={isCorrect ? 'success' : 'error'} size="sm" className="shrink-0 font-medium">
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-slate-700 pt-1">
                    <p className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-slate-500 font-medium">Your Answer:</span>
                      <strong className={`font-semibold ${!hasAnswered ? 'text-slate-500 italic' : isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                        {displayUserAnswer}
                      </strong>
                    </p>
                    
                    <p className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-slate-500 font-medium">Correct Answer:</span>
                      {displayCorrectAnswer ? (
                        <strong className="text-emerald-700 font-semibold">
                          {displayCorrectAnswer}
                        </strong>
                      ) : (
                        <span className="text-amber-600 italic text-[11px]">
                          Correct answer data currently unavailable for this question (ID: {q.id || `Q${idx + 1}`})
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Step-by-step Solution Card */}
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs leading-relaxed mt-2.5">
                    <strong className="text-slate-900 block mb-1 font-semibold">Explanation:</strong>
                    <p className="whitespace-pre-line text-slate-600 font-normal">
                      {explanationText}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Bottom CTAs */}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="md" onClick={handleBackToHub}>
            Back to Practice Hub
          </Button>
          <Button variant="primary" size="md" onClick={handleRetakeAssessment}>
            Retake Assessment
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default PracticeFlow;

