import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { EntranceEffect, VictoryEffect } from '../components/battle/BattleEffects';
import { 
  FaCircleCheck,
  FaCircleXmark,
  FaUserGroup,
  FaCrown,
  FaArrowLeft,
  FaRegClock,
  FaPlay,
  FaWhatsapp,
  FaCopy,
  FaRightToBracket,
  FaPlus,
  FaFaceSmile
} from 'react-icons/fa6';
import { getUserAvatarUrl } from '../utils/avatarResolver';
import type { BattleResult } from '../types';
import { SUBJECT_LIST, getTopicsForSubject } from '../constants/subjects';

const QUICK_MATCH_SUBJECT = 'quantitative_aptitude';
const QUICK_MATCH_TOPICS = getTopicsForSubject('quantitative_aptitude');

interface QuizQuestion {
  id?: string;
  questionIndex?: number;
  questionText: string;
  options: string[];
  category?: string;
  difficulty?: string;
}

interface AnswerFeedback {
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  correctOption: number;
  explanation?: string;
  pointsAwarded?: number;
}

interface Opponent {
  userId: string;
  displayName: string;
  level: number;
  rating: number;
  photoURL?: string;
  equippedRing?: string | null;
  equippedFrame?: string | null;
  equippedBackground?: string | null;
  equippedTitle?: string | null;
  equippedEmote?: string | null;
  equippedEntrance?: string | null;
  equippedVictory?: string | null;
}


function isValidQuizSet(quiz: any): quiz is QuizQuestion[] {
  return (
    Array.isArray(quiz) &&
    quiz.length > 0 &&
    quiz.every(
      (q) =>
        q &&
        typeof q.questionText === 'string' &&
        q.questionText.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.every((opt: any) => typeof opt === 'string')
    )
  );
}

interface BattleErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class BattleErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  BattleErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): BattleErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected battle initialization error.'
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[BattleErrorBoundary] Caught runtime error in Battle Arena:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/70 shadow-sm text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <FaCircleXmark className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Unable to initialize battle
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Something went wrong while preparing the battle interface. Your session state is safe.
            </p>
            {import.meta.env.DEV && this.state.errorMessage && (
              <p className="text-[11px] font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg break-words">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Retry Initialization
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                this.props.onReset?.();
                window.location.href = '/battle';
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              Return to Battle Arena
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const BattleInner: React.FC = () => {
  const { token, userProfile, updateProfile } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();

  // Setup Lounge states
  const [loungeTab, setLoungeTab] = useState<'quick' | 'friend'>('quick');
  const [customSubTab, setCustomSubTab] = useState<'create' | 'join'>('create');
  const [status, setStatus] = useState<'lounge' | 'searching' | 'match_ready' | 'lobby' | 'battle' | 'concluded'>('lounge');
  const [matchmakingState, setMatchmakingState] = useState<
    'idle' | 'checking_session' | 'searching' | 'matched' | 'battle_active' | 'cancelling' | 'cancelled' | 'completed' | 'error'
  >('idle');
  const [matchError, setMatchError] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{
    battleId: string;
    battleType?: string;
    opponent?: Opponent | null;
    currentQuestionIndex?: number;
    totalQuestions?: number;
    playerScore?: number;
  } | null>(null);
  const [isAbandoningBattle, setIsAbandoningBattle] = useState(false);
  const [searchStatusMsg, setSearchStatusMsg] = useState('Searching for opponents...');
  const [searchElapsedSeconds, setSearchElapsedSeconds] = useState(0);
  const isSearchingRef = useRef(false);
  const searchCancelledRef = useRef(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const roomQuery = searchParams.get('room');

  // Lobby States
  const [lobbyRoom, setLobbyRoom] = useState<any | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [lobbyTimeLeft, setLobbyTimeLeft] = useState('30:00');
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Room Join State
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  useEffect(() => {
    if (status === 'lobby' && lobbyRoom?.expirationTime) {
      const interval = setInterval(() => {
        const exp = new Date(lobbyRoom.expirationTime).getTime();
        const now = Date.now();
        const diff = exp - now;
        if (diff <= 0) {
          clearInterval(interval);
          setLobbyTimeLeft('00:00');
          setStatus('lounge');
          setSearchParams({});
        } else {
          const mins = Math.floor(diff / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          setLobbyTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, lobbyRoom, setSearchParams]);
  
  // Custom battle settings form states
  const [selectedSubject, setSelectedSubject] = useState('quantitative_aptitude');
  const [selectedTopic, setSelectedTopic] = useState(() => getTopicsForSubject('quantitative_aptitude')[0] || '');
  const [questionsCount, setQuestionsCount] = useState(5);
  const [difficulty, setDifficulty] = useState('Medium');
  const [timeLimit, setTimeLimit] = useState(30);
  const [isPrivate, setIsPrivate] = useState(true);

  // Dynamic Top 5 topics for custom challenges
  const availableTopics = useMemo(() => {
    return getTopicsForSubject(selectedSubject);
  }, [selectedSubject]);

  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
    const nextTopics = getTopicsForSubject(newSubject);
    setSelectedTopic(nextTopics[0] || '');
  };

  const handleTopicChange = (newTopic: string) => {
    setSelectedTopic(newTopic);
  };

  // Combat details
  const [battleId, setBattleId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [showEntrance, setShowEntrance] = useState(false);

  useEffect(() => {
    if (status === 'battle') {
      setShowEntrance(true);
    }
  }, [status]);

  // Mutable refs to prevent stale closure races inside socket event handlers
  const questionsRef = useRef<QuizQuestion[]>([]);
  const currentIndexRef = useRef(0);
  const selectedOptionRef = useRef<number | null>(null);
  const isSubmittingRef = useRef(false);
  const statusRef = useRef(status);

  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { selectedOptionRef.current = selectedOption; }, [selectedOption]);
  useEffect(() => { isSubmittingRef.current = isSubmittingAnswer; }, [isSubmittingAnswer]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Real-time tracking
  const [playerScore, setPlayerScore] = useState(0);
  const [playerCompletedQuestions, setPlayerCompletedQuestions] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState({ progressIndex: 0, score: 0, finished: false });
  const [battleResult, setBattleResult] = useState<BattleResult | any | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(30);
  const [battleTimeLimit, setBattleTimeLimit] = useState(30);
  const [battleFlowState, setBattleFlowState] = useState<
    'MATCHED' | 'INITIALIZING' | 'QUESTION_ACTIVE' | 'ANSWER_SUBMITTED' | 'WAITING_FOR_OPPONENT' | 'ADVANCING_QUESTION' | 'COMPLETED' | 'CANCELLED' | 'ERROR'
  >('INITIALIZING');
  const advanceTimerRef = useRef<number | null>(null);
  const submitRetryTimerRef = useRef<number | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  const [battleAlert, setBattleAlert] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [lobbyLoadingMessage, setLobbyLoadingMessage] = useState('Preparing battle...');
  const [lobbyLoadingProgress, setLobbyLoadingProgress] = useState(0);
  const [lobbyLoadingSlow, setLobbyLoadingSlow] = useState(false);
  
  // Emote state
  const [activeEmote, setActiveEmote] = useState<string | null>(null);

  const handlePlayEmote = () => {
    if (!userProfile?.equippedEmote || activeEmote) return;
    setActiveEmote(userProfile.equippedEmote);
    setTimeout(() => setActiveEmote(null), 2500);
  };

  // WebSocket instances
  const matchmakingSocket = useRef<Socket | null>(null);
  const battleSocket = useRef<Socket | null>(null);

  const getSocketUrl = () => {
    return (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || window.location.origin).replace(/\/$/, '');
  };

  // Automatic Stale Session Recovery & Active Battle Detection on load
  useEffect(() => {
    if (!token || !userProfile?.uid || roomQuery || status !== 'lounge') return;
    let cancelled = false;

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/battle/active-session', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.hasActiveBattle && data.battleId) {
          setActiveSession({
            battleId: data.battleId,
            battleType: data.battleType,
            opponent: data.opponent || null,
            currentQuestionIndex: data.currentQuestionIndex,
            totalQuestions: data.totalQuestions,
            playerScore: data.playerScore
          });
        } else {
          setActiveSession(null);
        }
      } catch {
        // Non-fatal
      }
    };

    checkSession();
    return () => { cancelled = true; };
  }, [token, userProfile?.uid, roomQuery, status]);

  // Elapsed timer while searching in Quick Match queue
  useEffect(() => {
    if (status !== 'searching') {
      setSearchElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setSearchElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  // 1. Join matchmaking queue (Strictly Quantitative Aptitude) with pre-flight session validation
  const handleStartSearch = async () => {
    if (
      isSearchingRef.current ||
      matchmakingState === 'checking_session' ||
      matchmakingState === 'searching' ||
      matchmakingState === 'matched' ||
      status === 'searching' ||
      status === 'match_ready' ||
      status === 'battle'
    ) {
      return;
    }

    isSearchingRef.current = true;
    searchCancelledRef.current = false;
    setMatchError(null);
    setMatchmakingState('checking_session');

    // Pre-flight backend validation & stale session recovery
    try {
      const checkRes = await fetch('/api/auth/battle/active-session', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (checkRes.ok) {
        const sessionData = await checkRes.json();
        if (searchCancelledRef.current) {
          isSearchingRef.current = false;
          setMatchmakingState('idle');
          return;
        }
        if (sessionData.hasActiveBattle && sessionData.battleId) {
          isSearchingRef.current = false;
          setActiveSession({
            battleId: sessionData.battleId,
            battleType: sessionData.battleType,
            opponent: sessionData.opponent || null,
            currentQuestionIndex: sessionData.currentQuestionIndex,
            totalQuestions: sessionData.totalQuestions,
            playerScore: sessionData.playerScore
          });
          setMatchError('You are already participating in an active battle. Resume or abandon it below.');
          setMatchmakingState('error');
          setStatus('lounge');
          return;
        }
        setActiveSession(null);
      }
    } catch {
      // Proceed to socket check if pre-flight endpoint is unreachable; socket enforces server-side too
    }

    if (searchCancelledRef.current) {
      isSearchingRef.current = false;
      setMatchmakingState('idle');
      return;
    }

    setMatchmakingState('searching');
    setStatus('searching');
    setSearchElapsedSeconds(0);
    setSearchStatusMsg('Connecting to Quantitative Aptitude matchmaking...');

    // Clean any stale socket before opening a new one
    if (matchmakingSocket.current) {
      matchmakingSocket.current.removeAllListeners();
      matchmakingSocket.current.disconnect();
      matchmakingSocket.current = null;
    }

    // Connect to matchmaking namespace with Firebase Auth token
    const socket = io(`${getSocketUrl()}/matchmaking`, {
      transports: ['websocket'],
      auth: { token }
    });
    matchmakingSocket.current = socket;

    socket.on('connect', () => {
      if (searchCancelledRef.current) return;
      setSearchStatusMsg('Searching for an Aptitude competitor...');
      socket.emit('join_lobby', {
        battleType: QUICK_MATCH_SUBJECT,
        rating: userProfile?.battleRating || 1000,
        profile: {
          displayName: userProfile?.displayName || 'Anonymous',
          level: userProfile?.level || 1,
          avatar: getUserAvatarUrl(userProfile),
          equippedRing: userProfile?.equippedRing || '',
          equippedFrame: userProfile?.equippedFrame || '',
          equippedBackground: userProfile?.equippedBackground || '',
          equippedTitle: userProfile?.equippedTitle || ''
        }
      });
    });

    socket.on('connect_error', (err: any) => {
      if (searchCancelledRef.current) return;
      isSearchingRef.current = false;
      socket.removeAllListeners();
      socket.disconnect();
      if (matchmakingSocket.current === socket) matchmakingSocket.current = null;
      setMatchError(err?.message || 'Unable to connect to matchmaking server. Please try again.');
      setMatchmakingState('error');
      setStatus('lounge');
      setSearchElapsedSeconds(0);
    });

    socket.on('disconnect', () => {
      if (searchCancelledRef.current || statusRef.current !== 'searching') return;
      isSearchingRef.current = false;
      if (matchmakingSocket.current === socket) matchmakingSocket.current = null;
      setMatchError('Matchmaking connection was interrupted. Please try again.');
      setMatchmakingState('error');
      setStatus('lounge');
      setSearchElapsedSeconds(0);
    });

    socket.on('match_status', (data: { message: string }) => {
      if (!searchCancelledRef.current) {
        setSearchStatusMsg(data.message);
      }
    });

    socket.on('match_found', (data: { battleId: string; opponent: Opponent; quiz: QuizQuestion[] }) => {
      if (searchCancelledRef.current) {
        socket.removeAllListeners();
        socket.disconnect();
        if (matchmakingSocket.current === socket) matchmakingSocket.current = null;
        return;
      }

      if (!data?.battleId || !isValidQuizSet(data?.quiz)) {
        isSearchingRef.current = false;
        socket.removeAllListeners();
        socket.disconnect();
        if (matchmakingSocket.current === socket) matchmakingSocket.current = null;
        setMatchError('Unable to initialize battle: received incomplete question data. Please try again.');
        setMatchmakingState('error');
        setStatus('lounge');
        setSearchElapsedSeconds(0);
        return;
      }

      isSearchingRef.current = false;
      setMatchmakingState('matched');
      setActiveSession(null);
      setMatchError(null);
      setBattleId(data.battleId);
      setOpponent(data.opponent || null);
      setQuestions(data.quiz);
      setPlayerScore(0);
      setPlayerCompletedQuestions(0);
      setOpponentProgress({ progressIndex: 0, score: 0, finished: false });
      setCurrentIndex(0);
      currentIndexRef.current = 0;

      // Clean matchmaking socket
      socket.removeAllListeners();
      socket.disconnect();
      if (matchmakingSocket.current === socket) matchmakingSocket.current = null;

      // Show brief Opponent Found preparation card before entering synchronized combat
      setStatus('match_ready');
      setTimeout(() => {
        if (!searchCancelledRef.current) {
          setMatchmakingState('battle_active');
          setStatus('battle');
        }
      }, 1600);
    });

    socket.on('match_error', (data: { message: string; code?: string; battleId?: string }) => {
      isSearchingRef.current = false;
      searchCancelledRef.current = true;
      socket.removeAllListeners();
      socket.disconnect();
      if (matchmakingSocket.current === socket) matchmakingSocket.current = null;

      if (data.code === 'ACTIVE_BATTLE_EXISTS' && data.battleId) {
        setActiveSession({ battleId: data.battleId });
      }
      setMatchError(data.message || 'Matchmaking error occurred.');
      setMatchmakingState('error');
      setStatus('lounge');
      setSearchElapsedSeconds(0);
    });
  };

  const handleCancelSearch = () => {
    // Prevent cancelling an already confirmed match or active battle
    if (matchmakingState === 'matched' || status === 'match_ready' || status === 'battle') {
      return;
    }

    setMatchmakingState('cancelling');
    searchCancelledRef.current = true;
    isSearchingRef.current = false;

    if (matchmakingSocket.current) {
      matchmakingSocket.current.emit('leave_lobby', { userId: userProfile?.uid });
      matchmakingSocket.current.removeAllListeners();
      matchmakingSocket.current.disconnect();
      matchmakingSocket.current = null;
    }

    setStatus('lounge');
    setSearchElapsedSeconds(0);
    setSearchParams({});
    setPlayerScore(0);
    setPlayerCompletedQuestions(0);
    setOpponentProgress({ progressIndex: 0, score: 0, finished: false });
    setMatchmakingState('idle');
  };

  const handleResumeActiveBattle = () => {
    if (!activeSession?.battleId) return;
    setMatchError(null);
    setBattleId(activeSession.battleId);
    setSearchParams({ room: activeSession.battleId });
    setMatchmakingState('battle_active');
    setStatus('battle');
  };

  const handleAbandonActiveBattle = async (targetBattleId?: string) => {
    const idToAbandon = targetBattleId || activeSession?.battleId || battleId;
    setIsAbandoningBattle(true);
    try {
      if (battleSocket.current && idToAbandon) {
        battleSocket.current.emit('abandon_battle', { battleId: idToAbandon });
      }
      await fetch('/api/auth/battle/abandon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ battleId: idToAbandon })
      });
    } catch {
      // Non-fatal
    } finally {
      setIsAbandoningBattle(false);
      setActiveSession(null);
      setMatchError(null);
      setMatchmakingState('idle');
      if (battleSocket.current) {
        battleSocket.current.disconnect();
        battleSocket.current = null;
      }
      setBattleId(null);
      setStatus('lounge');
      setSearchParams({});
      setPlayerScore(0);
      setPlayerCompletedQuestions(0);
      setOpponentProgress({ progressIndex: 0, score: 0, finished: false });
    }
  };

  const handleLeaveLobby = () => {
    if (status === 'battle' && battleId) {
      void handleAbandonActiveBattle(battleId);
      return;
    }
    if (battleSocket.current) {
      battleSocket.current.disconnect();
      battleSocket.current = null;
    }
    setBattleId(null);
    setMatchmakingState('idle');
    setStatus('lounge');
    setSearchParams({});
    setPlayerScore(0);
    setPlayerCompletedQuestions(0);
    setOpponentProgress({ progressIndex: 0, score: 0, finished: false });
  };

  const handleToggleReady = () => {
    if (battleSocket.current && battleId) {
      battleSocket.current.emit('toggle_ready', {
        battleId,
        userId: userProfile?.uid
      });
    }
  };

  const handleStartBattle = () => {
    if (battleSocket.current && battleId) {
      battleSocket.current.emit('start_battle_request', {
        battleId,
        userId: userProfile?.uid
      });
    }
  };

  const handleCreateCustomRoom = async () => {
    if (!selectedSubject || !selectedTopic) {
      setJoinError('Please select both a subject and a topic before creating a room.');
      return;
    }
    setIsCreatingRoom(true);
    setJoinError(null);
    try {
      const res = await fetch('/api/auth/battle-room/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          battleType: selectedSubject,
          questionsCount,
          difficulty,
          timeLimit,
          topic: selectedTopic,
          isPrivate
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create room');
      setSearchParams({ room: data.roomId || data.room.roomId });
    } catch (err: any) {
      setJoinError(err.message || 'Lobby creation failed.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinCustomRoom = async (codeToJoin?: string) => {
    const targetCode = (codeToJoin || joinRoomCode).trim().toUpperCase();
    if (!targetCode) {
      setJoinError('Please enter a valid room code.');
      return;
    }
    setJoinError(null);
    setIsJoiningRoom(true);

    try {
      const res = await fetch('/api/auth/battle-room/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomCode: targetCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join battle room.');
      }
      setSearchParams({ room: data.roomId });
    } catch (err: any) {
      setJoinError(err.message || 'Unable to join custom battle.');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleShareInvite = () => {
    if (!lobbyRoom) return;
    const appBaseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
    const inviteLink = `${appBaseUrl}/battle?room=${lobbyRoom.roomId}`;
    const subjectName = SUBJECT_LIST.find(s => s.slug === lobbyRoom.battleType)?.name || lobbyRoom.battleType;
    const topicDetails = lobbyRoom.settings?.topic
      ? `\nTopic: ${lobbyRoom.settings.topic}`
      : '';
    const text = `🔥 I challenge you to a 1v1 battle on CrackPlace AI!\n\nRoom Code: ${lobbyRoom.roomId}\nSubject: ${subjectName}${topicDetails}\nDifficulty: ${lobbyRoom.settings.difficulty}\nQuestions: ${lobbyRoom.settings.questionsCount}\n\nCan you beat me?\n\nJoin here:\n${inviteLink}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'CrackPlace AI Battle Challenge',
        text,
        url: inviteLink
      }).catch(err => console.log('Share error:', err));
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  // Synchronize room URL search query and auto-enroll
  useEffect(() => {
    if (roomQuery && token) {
      const normalizedQuery = roomQuery.trim().toUpperCase();
      setBattleId(normalizedQuery);
      setStatus('lobby');

      // Auto-join / fetch fresh room state
      fetch('/api/auth/battle-room/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomCode: normalizedQuery })
      })
        .then(res => res.json())
        .then(data => {
          if (data.room) {
            setLobbyRoom(data.room);
          } else if (data.error) {
            setBattleAlert({ text: data.error, type: 'error' });
          }
        })
        .catch(err => {
          console.warn('Failed to auto-enroll from room URL query', err);
        });
    }
  }, [roomQuery, token]);

  // 2. Battle socket connection & message receivers
  useEffect(() => {
    if (!battleId || (status !== 'battle' && status !== 'lobby') || !token) {
      return;
    }

    // Create socket if not already existing
    if (!battleSocket.current) {
      battleSocket.current = io(`${getSocketUrl()}/battle`, {
        transports: ['websocket'],
        auth: { token }
      });
    }

    const socket = battleSocket.current;

    const onConnect = () => {
      socket.emit('join_room', {
        battleId,
        userId: userProfile?.uid
      });
    };

    const onRoomError = (data: { message: string }) => {
      alert(data.message);
      setStatus('lounge');
      setSearchParams({});
    };

    const onBattleError = (data: { message: string }) => {
      setIsSubmittingAnswer(false);
      isSubmittingRef.current = false;
      setSelectedOption(null);
      selectedOptionRef.current = null;
      setLobbyLoading(false);
      setBattleAlert({ text: data.message || 'Battle notification', type: 'error' });
    };

    const handleConcludedData = (data: any) => {
      if (!data) return;

      let normalized: any = { ...data };
      if (data.battleResult) normalized = { ...data.battleResult };
      if (data.resultPackage) normalized = { ...data.resultPackage };

      const myUid = userProfile?.uid;
      const isWinner = normalized.winnerId === myUid;
      const isDraw = normalized.isDraw || normalized.winnerId === 'draw';
      const outcome = isDraw ? 'DRAW' : (isWinner ? 'WIN' : 'LOSS');

      // Synthesize playerReward and opponentReward if received as raw room payload
      if (!normalized.playerReward) {
        let myPlayerData: any = null;
        let oppPlayerData: any = null;

        if (Array.isArray(normalized.players)) {
          myPlayerData = normalized.players.find((p: any) => p.userId === myUid);
          oppPlayerData = normalized.players.find((p: any) => p.userId !== myUid);
        } else if (normalized.player1 && normalized.player2) {
          if (normalized.player1.userId === myUid) {
            myPlayerData = normalized.player1;
            oppPlayerData = normalized.player2;
          } else {
            myPlayerData = normalized.player2;
            oppPlayerData = normalized.player1;
          }
        }

        const myScore = myPlayerData?.score ?? normalized.finalScores?.[myUid || ''] ?? playerScore;
        const oppScore = oppPlayerData?.score ?? (oppPlayerData?.userId ? normalized.finalScores?.[oppPlayerData.userId] : 0) ?? opponentProgress.score;

        normalized.playerReward = {
          outcome: myPlayerData?.outcome || outcome,
          score: myScore,
          opponentScore: oppScore,
          xp: {
            earned: myPlayerData?.xpEarned ?? myPlayerData?.xp ?? 0,
            leveledUp: myPlayerData?.leveledUp || false,
            levelAfter: myPlayerData?.levelAfter || userProfile?.level || 1
          },
          coins: {
            earned: myPlayerData?.coinsEarned ?? myPlayerData?.coins ?? 0
          },
          elo: {
            current: myPlayerData?.eloAfter ?? myPlayerData?.elo ?? userProfile?.battleRating ?? 1000,
            change: myPlayerData?.eloChange ?? (myPlayerData?.eloAfter !== undefined && myPlayerData?.eloBefore !== undefined ? myPlayerData.eloAfter - myPlayerData.eloBefore : 0)
          }
        };

        if (oppPlayerData) {
          normalized.opponentReward = {
            score: oppScore,
            xp: oppPlayerData.xpEarned ?? oppPlayerData.xp ?? 0,
            coins: oppPlayerData.coinsEarned ?? oppPlayerData.coins ?? 0
          };
        }
      }

      setBattleResult(normalized);
      setActiveSession(null);
      setMatchError(null);
      setMatchmakingState('completed');
      setStatus('concluded');
      statusRef.current = 'concluded';
      setBattleAlert(null);

      if (battleSocket.current) {
        battleSocket.current.disconnect();
        battleSocket.current = null;
      }

      setTimeout(() => {
        fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(verified => {
            if (verified.profile) updateProfile(verified.profile);
          })
          .catch(() => {});
      }, 1500);
    };

    const onBattleRestored = (data: any) => {
      if (data.status === 'COMPLETED' || data.concluded || data.battleResult || data.resultPackage) {
        handleConcludedData(data.battleResult || data.resultPackage || data);
        return;
      }

      if (data.quiz && data.quiz.length > 0) {
        setQuestions(data.quiz);
        questionsRef.current = data.quiz;
      }
      const restoredIdx = typeof data.currentQuestionIndex === 'number' ? data.currentQuestionIndex : 0;
      if (typeof data.timeLimitPerQuestion === 'number' && data.timeLimitPerQuestion > 0) {
        setBattleTimeLimit(data.timeLimitPerQuestion);
      }

      // Prevent mid-question restore from wiping out an active in-flight submission for the same question
      if (statusRef.current === 'battle' && restoredIdx === currentIndexRef.current && isSubmittingRef.current) {
        if (typeof data.playerScore === 'number') setPlayerScore(data.playerScore);
        if (data.opponentProgress) {
          setOpponentProgress({
            progressIndex: data.opponentProgress.progressIndex || 0,
            score: data.opponentProgress.score || 0,
            finished: data.opponentProgress.finished || false
          });
        }
        return;
      }

      setCurrentIndex(restoredIdx);
      currentIndexRef.current = restoredIdx;
      setPlayerCompletedQuestions(restoredIdx);

      setSelectedOption(null);
      selectedOptionRef.current = null;
      setAnswerFeedback(null);
      setIsSubmittingAnswer(false);
      isSubmittingRef.current = false;

      if (typeof data.playerScore === 'number') setPlayerScore(data.playerScore);
      setBattleFlowState(restoredIdx >= (data.quiz?.length || questionsRef.current.length || 1) ? 'WAITING_FOR_OPPONENT' : 'QUESTION_ACTIVE');
      setStatus('battle');
      statusRef.current = 'battle';

      if (data.opponentProgress) {
        setOpponentProgress({
          progressIndex: data.opponentProgress.progressIndex || 0,
          score: data.opponentProgress.score || 0,
          finished: data.opponentProgress.finished || false
        });
      }
      if (restoredIdx > 0) {
        setBattleAlert({ text: '🔄 Battle Restored', type: 'info' });
      }
    };

    const onPlayerDisconnected = (data: { userId: string; gracePeriodSeconds: number }) => {
      setBattleAlert({ text: `⚠️ Opponent disconnected (${data.gracePeriodSeconds}s grace window)`, type: 'error' });
    };

    const onPlayerReconnected = () => {
      setBattleAlert({ text: '🟢 Opponent reconnected!', type: 'success' });
    };

    const onLobbyUpdated = (roomData: any) => {
      setLobbyRoom(roomData);
      const opponentUid = Object.keys(roomData.players || {}).find(uid => uid !== userProfile?.uid);
      if (opponentUid) {
        const opp = roomData.players[opponentUid];
        setOpponent({
          userId: opp.uid,
          displayName: opp.displayName,
          level: opp.level,
          rating: opp.battleRating,
          photoURL: opp.photoURL,
          equippedRing: opp.equippedRing,
          equippedFrame: opp.equippedFrame,
          equippedBackground: opp.equippedBackground,
          equippedTitle: opp.equippedTitle
        });
      } else {
        setOpponent(null);
      }
    };

    const onBattlePreparing = () => {
      setLobbyLoading(true);
      setLobbyLoadingProgress(10);
    };

    const onBattleStarting = (data: { quiz: QuizQuestion[] }) => {
      setLobbyLoading(false);
      setLobbyLoadingProgress(100);
      setQuestions(data.quiz);
      questionsRef.current = data.quiz;
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      setPlayerScore(0);
      setPlayerCompletedQuestions(0);
      setOpponentProgress({ progressIndex: 0, score: 0, finished: false });
      setSelectedOption(null);
      selectedOptionRef.current = null;
      setAnswerFeedback(null);
      setIsSubmittingAnswer(false);
      isSubmittingRef.current = false;
      
      let count = 3;
      setCountdown(count);
      
      const interval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(interval);
          setCountdown(null);
          setStatus('battle');
          statusRef.current = 'battle';
        } else {
          setCountdown(count);
        }
      }, 1000);
    };

    const onPlayerJoined = (data: { userId: string }) => {
      console.log(`Opponent player joined room: ${data.userId}`);
    };

    const onAnswerEvaluated = (data: {
      questionIndex: number;
      selectedOption?: number;
      isCorrect: boolean;
      score: number;
      pointsAwarded?: number;
      explanation?: string;
      correctOption: number;
      nextQuestionIndex?: number;
      totalQuestions?: number;
    }) => {
      if (submitRetryTimerRef.current) {
        window.clearTimeout(submitRetryTimerRef.current);
        submitRetryTimerRef.current = null;
      }

      setPlayerScore(data.score);
      const nextProgress = typeof data.nextQuestionIndex === 'number'
        ? data.nextQuestionIndex
        : (data.questionIndex + 1);
      setPlayerCompletedQuestions(nextProgress);

      const chosenOption = selectedOptionRef.current ?? (typeof data.selectedOption === 'number' ? data.selectedOption : -1);

      const feedback: AnswerFeedback = {
        questionIndex: data.questionIndex,
        selectedOption: chosenOption,
        isCorrect: data.isCorrect,
        correctOption: data.correctOption,
        explanation: data.explanation,
        pointsAwarded: data.pointsAwarded
      };
      setAnswerFeedback(feedback);
      setBattleFlowState('ADVANCING_QUESTION');

      const ptsStr = (typeof data.pointsAwarded === 'number' && data.pointsAwarded > 0) ? `+${data.pointsAwarded}` : (data.isCorrect ? '+20' : '+0');
      setBattleAlert({
        text: data.isCorrect ? `⚡ Correct! ${ptsStr}` : '❌ Wrong!',
        type: data.isCorrect ? 'success' : 'error'
      });

      if (advanceTimerRef.current) {
        window.clearTimeout(advanceTimerRef.current);
      }
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        const nextIdx = typeof data.nextQuestionIndex === 'number'
          ? data.nextQuestionIndex
          : (currentIndexRef.current + 1);

        setCurrentIndex(nextIdx);
        currentIndexRef.current = nextIdx;
        setSelectedOption(null);
        selectedOptionRef.current = null;
        setAnswerFeedback(null);
        setIsSubmittingAnswer(false);
        isSubmittingRef.current = false;
        setBattleAlert(null);
        const totalQ = data.totalQuestions || questionsRef.current.length || 5;
        setBattleFlowState(nextIdx >= totalQ ? 'WAITING_FOR_OPPONENT' : 'QUESTION_ACTIVE');
      }, 1200);
    };

    const onStepUpdate = (data: { uid: string; score: number; progressIndex: number; finished: boolean }) => {
      // Never overwrite opponentProgress with our own echoed step_update
      if (data.uid && data.uid === userProfile?.uid) return;

      setOpponentProgress({
        progressIndex: data.progressIndex,
        score: data.score,
        finished: data.finished
      });

      if (data.finished) {
        setBattleAlert({ text: '🏁 Opponent Finished', type: 'info' });
      } else {
        setBattleAlert({ text: '🔥 Opponent Answered', type: 'info' });
      }

      setTimeout(() => {
        setBattleAlert(prev => {
          if (prev?.text.includes('Opponent')) return null;
          return prev;
        });
      }, 2000);
    };

    const onBattleConcluded = (data: any) => {
      handleConcludedData(data);
    };

    // Remove previous listeners before re-registering to avoid duplicates
    socket.off('connect', onConnect);
    socket.off('room_error', onRoomError);
    socket.off('battle_error', onBattleError);
    socket.off('battle_restored', onBattleRestored);
    socket.off('player_disconnected', onPlayerDisconnected);
    socket.off('player_reconnected', onPlayerReconnected);
    socket.off('lobby_updated', onLobbyUpdated);
    socket.off('battle_preparing', onBattlePreparing);
    socket.off('battle_starting', onBattleStarting);
    socket.off('player_joined', onPlayerJoined);
    socket.off('answer_evaluated', onAnswerEvaluated);
    socket.off('step_update', onStepUpdate);
    socket.off('battle_concluded', onBattleConcluded);
    socket.off('battle:completed', onBattleConcluded);
    socket.off('battle_completed', onBattleConcluded);

    // Register listeners
    socket.on('connect', onConnect);
    socket.on('room_error', onRoomError);
    socket.on('battle_error', onBattleError);
    socket.on('battle_restored', onBattleRestored);
    socket.on('player_disconnected', onPlayerDisconnected);
    socket.on('player_reconnected', onPlayerReconnected);
    socket.on('lobby_updated', onLobbyUpdated);
    socket.on('battle_preparing', onBattlePreparing);
    socket.on('battle_starting', onBattleStarting);
    socket.on('player_joined', onPlayerJoined);
    socket.on('answer_evaluated', onAnswerEvaluated);
    socket.on('step_update', onStepUpdate);
    socket.on('battle_concluded', onBattleConcluded);
    socket.on('battle:completed', onBattleConcluded);
    socket.on('battle_completed', onBattleConcluded);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      // If status becomes lounge or concluded or battleId cleared, cleanup socket
      if (statusRef.current === 'lounge' || statusRef.current === 'concluded' || !battleId) {
        socket.disconnect();
        battleSocket.current = null;
      }
    };
  }, [battleId, token, userProfile?.uid, updateProfile, setSearchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) window.clearTimeout(advanceTimerRef.current);
      if (submitRetryTimerRef.current) window.clearTimeout(submitRetryTimerRef.current);
      if (matchmakingSocket.current) matchmakingSocket.current.disconnect();
      if (battleSocket.current) battleSocket.current.disconnect();
    };
  }, []);

  // Lobby Starting Loading messages / progress simulation
  useEffect(() => {
    let interval: any;
    let timeout: any;
    let messageIndex = 0;
    const messages = [
      "⚔️ Preparing Battle...",
      "Generating AI Questions...",
      "Balancing difficulty...",
      "Loading battle room...",
      "Waiting for opponent...",
      "Almost Ready...",
      "Starting Battle..."
    ];

    if (lobbyLoading) {
      setLobbyLoadingSlow(false);
      setLobbyLoadingProgress(10);
      messageIndex = 0;
      setLobbyLoadingMessage(messages[0]);

      // Cycle messages and simulate progress increments
      interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % messages.length;
        setLobbyLoadingMessage(messages[messageIndex]);
        setLobbyLoadingProgress(prev => {
          if (prev >= 90) return 90;
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 1200);

      // Flag slow load if longer than 5 seconds
      timeout = setTimeout(() => {
        setLobbyLoadingSlow(true);
      }, 5000);
    }

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [lobbyLoading]);

  // Dynamic full-screen battle class trigger
  useEffect(() => {
    if (status === 'battle') {
      document.documentElement.classList.add('in-battle-gameplay');
    } else {
      document.documentElement.classList.remove('in-battle-gameplay');
    }
    return () => {
      document.documentElement.classList.remove('in-battle-gameplay');
    };
  }, [status]);

  // Question Local Timer Effect
  useEffect(() => {
    if (status === 'battle' && questions.length > 0 && currentIndex < questions.length && selectedOption === null) {
      const limit = lobbyRoom?.settings?.timeLimit || battleTimeLimit || 30;
      setQuestionTimeLeft(limit);
      questionStartTimeRef.current = Date.now();

      const timer = setInterval(() => {
        setQuestionTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAnswerSubmit(-1); // Time out submit
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status, currentIndex, selectedOption, questions.length, battleTimeLimit]);

  // Battle Finalization Safety Recovery (polls server state when all questions submitted)
  useEffect(() => {
    let checkInterval: any;
    if (status === 'battle' && questions.length > 0 && currentIndex >= questions.length && battleId) {
      checkInterval = setInterval(() => {
        if (battleSocket.current && battleSocket.current.connected) {
          battleSocket.current.emit('get_battle_state', { battleId });
          battleSocket.current.emit('battle:getState', { battleId });
        }
      }, 2000);
    }
    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [status, currentIndex, questions.length, battleId]);

  // 3. Question submit handler (Server-Authoritative with retry safety)
  const handleAnswerSubmit = (optionIdx: number) => {
    if (selectedOptionRef.current !== null || isSubmittingRef.current || !battleId) return;

    const qIdx = currentIndexRef.current;
    const responseTimeMs = Math.max(100, Date.now() - questionStartTimeRef.current);

    setIsSubmittingAnswer(true);
    isSubmittingRef.current = true;
    setSelectedOption(optionIdx);
    selectedOptionRef.current = optionIdx;
    setBattleFlowState('ANSWER_SUBMITTED');

    if (optionIdx === -1) {
      setBattleAlert({ text: '⏳ Time Out!', type: 'error' });
    }

    const emitSubmission = () => {
      if (battleSocket.current && battleSocket.current.connected) {
        battleSocket.current.emit('submit_answer', {
          battleId,
          questionIndex: qIdx,
          selectedOption: optionIdx,
          responseTimeMs
        });
      } else if (battleSocket.current) {
        battleSocket.current.connect();
      }
    };

    emitSubmission();

    // Safety retry if answer_evaluated is delayed or packet was dropped during reconnect
    if (submitRetryTimerRef.current) {
      window.clearTimeout(submitRetryTimerRef.current);
    }
    submitRetryTimerRef.current = window.setTimeout(() => {
      if (isSubmittingRef.current && currentIndexRef.current === qIdx && statusRef.current === 'battle') {
        emitSubmission();
        battleSocket.current?.emit('get_battle_state', { battleId });
      }
    }, 3000);
  };



  // State 1: Setup Lounge
  if (status === 'lounge') {
    return (
      <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
        {/* Header banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Competitive Assessment</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mt-1">Battle Arena</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Test your speed and accuracy against peers in synchronized 1v1 placement assessments.</p>
          </div>

          {/* Segmented Mode Selector */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setLoungeTab('quick')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                loungeTab === 'quick' 
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Quick Match
            </button>
            <button
              onClick={() => setLoungeTab('friend')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                loungeTab === 'friend' 
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Custom Challenge
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* Main Lounge Selection */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 rounded-xl space-y-6 shadow-xs">
            {loungeTab === 'quick' ? (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      Ranked 1v1 Quick Match
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                      Your Elo: {userProfile?.battleRating || 1000}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white pt-1">
                    Subject: Quantitative Aptitude
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Compete against another student in a synchronized aptitude assessment covering common placement topics.
                  </p>
                </div>

                {/* Common Aptitude Topics Covered */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Placement Topics Covered
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_MATCH_TOPICS.map(t => (
                      <span
                        key={t}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <FaCircleCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>5 questions per battle (MCQ format)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaCircleCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Same questions &amp; order for both players</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaCircleCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Server-controlled 30s per question timer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FaCircleCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Authoritative Elo, XP &amp; Coin rewards</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                    <FaRegClock className="w-4 h-4" />
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-slate-900 dark:text-white">Competitive Matchmaking Criteria</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Initially pairs within ±100 Elo, gradually expanding (±200 at 10s, ±300 at 20s, ±500 at 30s+) to ensure fair and fast matches.
                    </p>
                  </div>
                </div>

                {activeSession && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        Active Battle Session Found
                      </p>
                      <p className="text-amber-800/90 dark:text-amber-300/90">
                        You have an ongoing match{activeSession.opponent?.displayName ? ` vs ${activeSession.opponent.displayName}` : ''}. Resume or abandon it to start a new search.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleResumeActiveBattle}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Resume Battle
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbandonActiveBattle(activeSession.battleId)}
                        disabled={isAbandoningBattle}
                        className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {isAbandoningBattle ? 'Abandoning...' : 'Abandon'}
                      </button>
                    </div>
                  </div>
                )}

                {matchError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
                    <span>{matchError}</span>
                    <button
                      type="button"
                      onClick={() => { setMatchError(null); if (matchmakingState === 'error') setMatchmakingState('idle'); }}
                      className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 font-bold shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <button
                  onClick={handleStartSearch}
                  disabled={matchmakingState === 'checking_session' || matchmakingState === 'searching' || matchmakingState === 'matched'}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm tracking-wide text-white shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <FaPlay className="w-3.5 h-3.5" />
                  <span>{matchmakingState === 'checking_session' ? 'Validating Session...' : 'Find Competitor'}</span>
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                      Custom Challenge Arena
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Host a custom problem set or join an existing challenge via room code.</p>
                  </div>

                  {/* Sub-tabs: Create vs Join */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                      onClick={() => { setCustomSubTab('create'); setJoinError(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        customSubTab === 'create'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <FaPlus className="w-3 h-3" />
                      <span>Create Room</span>
                    </button>
                    <button
                      onClick={() => { setCustomSubTab('join'); setJoinError(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        customSubTab === 'join'
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <FaRightToBracket className="w-3 h-3" />
                      <span>Join Code</span>
                    </button>
                  </div>
                </div>

                {joinError && (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                    <FaCircleXmark className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span>{joinError}</span>
                  </div>
                )}

                {customSubTab === 'create' ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Subject */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Subject</label>
                        <select
                          value={selectedSubject}
                          onChange={e => handleSubjectChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        >
                          {SUBJECT_LIST.map(s => (
                            <option key={s.slug} value={s.slug}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Topic (Top 5 Common Topics) */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Topic (Top 5 Common)</label>
                        <select
                          value={selectedTopic}
                          onChange={e => handleTopicChange(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        >
                          {availableTopics.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      {/* Difficulty */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Difficulty Level</label>
                        <select
                          value={difficulty}
                          onChange={e => setDifficulty(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        >
                          <option value="Easy">Easy (Foundation)</option>
                          <option value="Medium">Medium (Campus Standard)</option>
                          <option value="Hard">Hard (Product Level)</option>
                          <option value="Mixed">Mixed (Balanced Tiers)</option>
                        </select>
                      </div>

                      {/* Question count */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Question Count</label>
                        <select
                          value={questionsCount}
                          onChange={e => setQuestionsCount(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        >
                          <option value="5">5 Questions (~3 mins)</option>
                          <option value="10">10 Questions (~6 mins)</option>
                          <option value="15">15 Questions (~10 mins)</option>
                          <option value="20">20 Questions (~15 mins)</option>
                          <option value="30">30 Questions (~22 mins)</option>
                        </select>
                      </div>

                      {/* Time limit */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Pace (Time per Question)</label>
                        <select
                          value={timeLimit}
                          onChange={e => setTimeLimit(Number(e.target.value))}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        >
                          <option value="15">15 Seconds (Blitz)</option>
                          <option value="30">30 Seconds (Standard)</option>
                          <option value="45">45 Seconds (Analytical)</option>
                          <option value="60">60 Seconds (Comprehensive)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      <input
                        type="checkbox"
                        id="isPrivate"
                        checked={isPrivate}
                        onChange={e => setIsPrivate(e.target.checked)}
                        className="w-4 h-4 rounded-sm border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                      <label htmlFor="isPrivate" className="text-xs text-slate-600 dark:text-slate-400 font-medium select-none cursor-pointer">
                        Private Room (Require unique invitation link / room code to join)
                      </label>
                    </div>

                    <button
                      onClick={handleCreateCustomRoom}
                      disabled={isCreatingRoom || !selectedTopic}
                      className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold text-sm tracking-wide text-white shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <FaUserGroup className="w-3.5 h-3.5" />
                      <span>{isCreatingRoom ? 'Creating Room...' : 'Create Challenge Room'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5 py-2">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                          Enter Room Code
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={joinRoomCode}
                            onChange={e => {
                              setJoinRoomCode(e.target.value.toUpperCase());
                              setJoinError(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleJoinCustomRoom();
                            }}
                            placeholder="e.g. DSA-7X9K2M or ABC123"
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-base tracking-widest uppercase focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            maxLength={20}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enter the unique alphanumeric room code provided by your peer to enter their lobby and synchronize assessment parameters.
                      </p>
                    </div>

                    <button
                      onClick={() => handleJoinCustomRoom()}
                      disabled={isJoiningRoom || !joinRoomCode.trim()}
                      className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed font-semibold text-sm tracking-wide text-white shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <FaRightToBracket className="w-3.5 h-3.5" />
                      <span>{isJoiningRoom ? 'Validating Room...' : 'Join Battle Room'}</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State 1.5: Lobby Waiting Room
  if (status === 'lobby' && lobbyRoom) {
    const playersMap = lobbyRoom.players || {};
    const host = playersMap[lobbyRoom.hostUid];
    
    const guestUid = Object.keys(playersMap).find(uid => uid !== lobbyRoom.hostUid);
    const guest = guestUid ? playersMap[guestUid] : null;

    const isHost = userProfile?.uid === lobbyRoom.hostUid;
    const myPlayerObj = playersMap[userProfile?.uid || ''];
    const isMeReady = myPlayerObj?.ready || false;
    const isOpponentReady = guest?.ready || false;

    const appBaseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
    const inviteLink = `${appBaseUrl}/battle?room=${lobbyRoom.roomId}`;

    const handleLocalCopy = () => {
      navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    };

    return (
      <div className="w-full max-w-2xl mx-auto space-y-4 sm:space-y-5 animate-fade-in pb-12 text-slate-900 dark:text-white overflow-x-hidden">
        {/* Navigation & Status Header */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={handleLeaveLobby}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <FaArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <div>
              <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">Waiting Room</h1>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Code: <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{lobbyRoom.roomId}</span></p>
                {lobbyRoom.battleType && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">
                    {SUBJECT_LIST.find(s => s.slug === lobbyRoom.battleType)?.name || lobbyRoom.battleType}
                  </span>
                )}
                {lobbyRoom.settings?.topic && lobbyRoom.settings.topic !== 'All' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">
                    {lobbyRoom.settings.topic}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
              <FaRegClock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{lobbyTimeLeft}</span>
            </div>
          </div>
        </div>

        {/* Preparing Battle Modal */}
        {lobbyLoading && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-fade-in p-6 text-center">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-xl space-y-5 shadow-lg">
              <div className="w-12 h-12 mx-auto rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
              <div className="space-y-1">
                <h2 className="font-bold text-lg text-slate-900 dark:text-white">
                  {lobbyLoadingMessage}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Assembling synchronized problem set...</p>
              </div>

              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full" 
                  style={{ width: `${lobbyLoadingProgress}%` }}
                ></div>
              </div>

              {lobbyLoadingSlow && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Connecting candidates across peer channels...
                </p>
              )}
            </div>
          </div>
        )}

        {countdown !== null && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-xs animate-fade-in">
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-2">Assessment Commencing</span>
            <div className="text-7xl font-extrabold text-white animate-pulse">
              {countdown}
            </div>
            <p className="text-xs text-slate-400 mt-4">Synchronizing question seed...</p>
          </div>
        )}

        {/* Players Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-xl space-y-4 sm:space-y-5 shadow-xs">
          {/* Mobile & Desktop Responsive Participants Grid */}
          <div className="relative grid grid-cols-2 sm:grid-cols-3 items-stretch sm:items-center gap-2.5 sm:gap-4">
            {/* Host Card */}
            <div className="min-w-0 flex flex-col items-center justify-between text-center space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase truncate max-w-full">
                {lobbyRoom.hostUid === userProfile?.uid ? 'You (Host)' : 'Host'}
              </span>
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-base font-bold text-slate-800 dark:text-white shrink-0">
                <img src={getUserAvatarUrl(host)} alt={host?.displayName || 'Host'} className="w-full h-full object-cover rounded-full" />
                {lobbyRoom.hostUid === userProfile?.uid && activeEmote && (
                  <div className="absolute -top-6 -right-2 text-3xl animate-bounce z-10 drop-shadow-md">
                    {activeEmote === 'emote_gg' || activeEmote === 'gg' ? '🎮' : 
                     activeEmote === 'emote_rip' || activeEmote === 'rip' ? '💀' : 
                     activeEmote === 'emote_sweat' || activeEmote === 'sweat' ? '😅' : '🔥'}
                  </div>
                )}
              </div>
              <div className="w-full min-w-0">
                <h3 className="font-semibold text-xs text-slate-900 dark:text-white truncate">{host?.displayName}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Rating: {host?.battleRating || 1000}</p>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                    Ready
                  </span>
                  {lobbyRoom.hostUid === userProfile?.uid && userProfile?.equippedEmote && (
                    <button onClick={handlePlayEmote} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-500 transition-colors cursor-pointer" title="Play Emote">
                      <FaFaceSmile className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Center VS + Invite Code */}
            <div className="hidden sm:flex flex-col items-center text-center min-w-0">
              <span className="font-bold text-2xl text-slate-400">VS</span>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Invite Code</span>
                <button 
                  type="button"
                  onClick={handleLocalCopy}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-0.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span>{lobbyRoom.roomId}</span>
                  {copiedInvite ? <FaCircleCheck className="w-3 h-3 text-emerald-500" /> : <FaCopy className="w-3 h-3" />}
                </button>
                {copiedInvite && <span className="block text-[10px] text-emerald-500 font-semibold mt-0.5">Copied!</span>}
              </div>
            </div>

            {/* Mobile Centered VS Pill */}
            <div className="sm:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center text-[10px] font-extrabold text-slate-500 dark:text-slate-300">
              VS
            </div>

            {/* Guest Card */}
            <div className="min-w-0 flex flex-col items-center justify-between text-center space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold tracking-wider text-purple-600 dark:text-purple-400 uppercase truncate max-w-full">
                {lobbyRoom.hostUid === userProfile?.uid ? 'Opponent' : 'You (Candidate)'}
              </span>
              {guest ? (
                <>
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-base font-bold text-slate-800 dark:text-white shrink-0">
                    <img src={getUserAvatarUrl(guest)} alt={guest.displayName || 'Guest'} className="w-full h-full object-cover rounded-full" />
                    {lobbyRoom.guestUid === userProfile?.uid && activeEmote && (
                      <div className="absolute -top-6 -right-2 text-3xl animate-bounce z-10 drop-shadow-md">
                        {activeEmote === 'emote_gg' || activeEmote === 'gg' ? '🎮' : 
                         activeEmote === 'emote_rip' || activeEmote === 'rip' ? '💀' : 
                         activeEmote === 'emote_sweat' || activeEmote === 'sweat' ? '😅' : '🔥'}
                      </div>
                    )}
                  </div>
                  <div className="w-full min-w-0">
                    <h3 className="font-semibold text-xs text-slate-900 dark:text-white truncate">{guest.displayName}</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Rating: {guest.battleRating}</p>
                    <div className="flex items-center justify-center gap-1.5 mt-1.5">
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        isOpponentReady 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}>
                        {isOpponentReady ? 'Ready' : 'Not Ready'}
                      </span>
                      {lobbyRoom.guestUid === userProfile?.uid && userProfile?.equippedEmote && (
                        <button onClick={handlePlayEmote} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-500 transition-colors cursor-pointer" title="Play Emote">
                          <FaFaceSmile className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-400 shrink-0">
                    ?
                  </div>
                  <div className="w-full min-w-0">
                    <h3 className="font-semibold text-xs text-slate-400 italic truncate">Waiting...</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">Awaiting link click</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Compact Invite Code Bar */}
          <div className="sm:hidden flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Invite Code</span>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 truncate block">{lobbyRoom.roomId}</span>
            </div>
            <button
              type="button"
              onClick={handleLocalCopy}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {copiedInvite ? <FaCircleCheck className="w-3.5 h-3.5 text-emerald-500" /> : <FaCopy className="w-3.5 h-3.5" />}
              <span>{copiedInvite ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Read-only Locked Challenge Configuration */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-1 mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Challenge Configuration
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                Locked by Host • Synchronized
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              <div className="min-w-0 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Subject</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">
                  {SUBJECT_LIST.find(s => s.slug === lobbyRoom.battleType)?.shortName || lobbyRoom.subject || lobbyRoom.battleType}
                </span>
              </div>
              <div className="min-w-0 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Topic</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                  {lobbyRoom.settings?.topic || 'Standard'}
                </span>
              </div>
              <div className="min-w-0 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Difficulty</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">
                  {lobbyRoom.settings?.difficulty || 'Medium'}
                </span>
              </div>
              <div className="min-w-0 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Questions</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">
                  {lobbyRoom.settings?.questionsCount || 5} MCQs
                </span>
              </div>
              <div className="min-w-0 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Timer</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">
                  {lobbyRoom.settings?.timeLimit || 30}s / Q
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Sharing Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl space-y-3 sm:space-y-4 shadow-xs">
          <div>
            <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Share Invitation Link</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Send this link to anyone to immediately match in this room.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="w-full min-w-0 sm:flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-blue-600 dark:text-blue-400 font-mono focus:outline-hidden truncate"
            />
            <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLocalCopy}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedInvite ? <FaCircleCheck className="w-3.5 h-3.5 text-emerald-500" /> : <FaCopy className="w-3.5 h-3.5" />}
                <span>{copiedInvite ? 'Copied!' : 'Copy'}</span>
              </button>
              <button
                type="button"
                onClick={handleShareInvite}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FaWhatsapp className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleLeaveLobby}
            disabled={lobbyLoading}
            className="w-full sm:w-1/3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {isHost ? (
            <button
              onClick={handleStartBattle}
              disabled={!guest || !isMeReady || !isOpponentReady || lobbyLoading}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors cursor-pointer flex items-center justify-center gap-2 px-2"
            >
              <span className="truncate">{(!guest) ? 'Waiting for opponent' : (!isMeReady || !isOpponentReady ? 'Waiting for ready' : lobbyLoading ? 'Loading...' : 'Start Assessment')}</span>
              <FaPlay className="w-3 h-3 shrink-0" />
            </button>
          ) : (
            <button
              onClick={handleToggleReady}
              disabled={lobbyLoading}
              className={`flex-1 py-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 px-2 ${
                isMeReady
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <span className="truncate">{isMeReady ? 'Cancel Ready' : 'Confirm Ready'}</span>
              <FaPlay className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // State 2: Searching Matchmaking
  if (status === 'searching') {
    const myElo = userProfile?.battleRating || 1000;
    const currentRange = searchElapsedSeconds < 10 ? 100 : searchElapsedSeconds < 20 ? 200 : searchElapsedSeconds < 30 ? 300 : 500;
    const mins = Math.floor(searchElapsedSeconds / 60);
    const secs = searchElapsedSeconds % 60;
    const formattedElapsed = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-5 animate-fade-in max-w-md mx-auto text-center px-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-3 border-blue-600 border-t-transparent animate-spin"></div>
        </div>
        <div className="space-y-1">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">Searching for Opponent...</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            {searchStatusMsg}
          </p>
        </div>

        <div className="w-full grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Waiting Time</span>
            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">{formattedElapsed}</span>
          </div>
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs">
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Elo Range (±{currentRange})</span>
            <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">{Math.max(100, myElo - currentRange)} — {myElo + currentRange}</span>
          </div>
        </div>

        <button
          onClick={handleCancelSearch}
          className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          Cancel Search
        </button>
      </div>
    );
  }

  // State 2.5: Opponent Found Preparation Screen
  if (status === 'match_ready' && opponent) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-5 animate-fade-in max-w-md mx-auto text-center px-4">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
          Competitor Matched!
        </span>
        <div className="w-full p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4 text-left">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-600 bg-slate-100 dark:bg-slate-800 shrink-0">
            <img src={opponent.photoURL || getUserAvatarUrl(opponent)} alt={opponent.displayName} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">{opponent.displayName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Level {opponent.level || 1} • <span className="font-semibold text-blue-600 dark:text-blue-400">{opponent.rating || 1000} Elo</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <span>Preparing synchronized Quantitative Aptitude battle...</span>
        </div>
      </div>
    );
  }

  // State 3: Assessment Concluded / Scorecard
  if (status === 'concluded' && battleResult) {
    const playerReward = battleResult.playerReward;
    const opponentReward = battleResult.opponentReward;
    const myDeltas = (battleResult as any).playerDeltas?.[userProfile?.uid || ''];

    const finalMyScore = playerReward?.score ?? myDeltas?.score ?? playerScore;
    const finalOppScore = playerReward?.opponentScore ?? opponentReward?.score ?? opponentProgress.score;

    const isDraw = Boolean(
      battleResult.isDraw ||
      battleResult.winnerId === 'draw' ||
      battleResult.winnerId === null ||
      playerReward?.outcome === 'DRAW' ||
      finalMyScore === finalOppScore
    );
    const isMeWinner = !isDraw && (battleResult.winnerId === userProfile?.uid || playerReward?.outcome === 'WIN');

    let outcomeTitle = 'Draw';
    let outcomeBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

    const eloVal = isDraw ? 0 : (playerReward?.elo?.change ?? myDeltas?.elo);
    const xpVal = playerReward?.xp?.earned ?? myDeltas?.xp;
    const coinsVal = playerReward?.coins?.earned ?? myDeltas?.coins;

    let eloChange = '0';
    if (isDraw) {
      eloChange = '0';
    } else if (typeof eloVal === 'number') {
      if (eloVal > 0) eloChange = `+${eloVal}`;
      else if (eloVal < 0) eloChange = `${eloVal}`;
      else eloChange = '0';
    }
    let coinsChange = coinsVal !== undefined ? (coinsVal > 0 ? `+${coinsVal}` : `${coinsVal}`) : '0';
    let xpChange = xpVal !== undefined ? (xpVal > 0 ? `+${xpVal}` : `${xpVal}`) : '0';

    if (!isDraw) {
      if (isMeWinner) {
        outcomeTitle = 'Victory';
        outcomeBadge = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      } else {
        outcomeTitle = 'Defeat';
        outcomeBadge = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      }
    }

    const leveledUp = playerReward?.xp?.leveledUp;
    const levelAfter = playerReward?.xp?.levelAfter;

    return (
      <div className="max-w-xl mx-auto text-center space-y-6 animate-fade-in py-8 relative">
        <VictoryEffect 
          type={isMeWinner ? (userProfile?.equippedVictory || null) : (isDraw ? null : (opponent?.equippedVictory || null))} 
          winnerName={isMeWinner ? (userProfile?.displayName || 'You') : (opponent?.displayName || 'Opponent')} 
        />
        <div className="space-y-2 relative z-10">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${outcomeBadge}`}>
            {outcomeTitle}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Peer Assessment Result</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Authoritative session results recorded to your placement profile.</p>

          {leveledUp && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold text-xs mt-2">
              <FaCrown className="w-3.5 h-3.5 text-amber-500" />
              <span>Level Advanced to {levelAfter}</span>
            </div>
          )}
        </div>

        {/* Score comparison */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl grid grid-cols-3 items-center shadow-xs">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img src={getUserAvatarUrl(userProfile)} alt={userProfile?.displayName || 'You'} className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">You</span>
              <p className="font-bold text-2xl text-slate-900 dark:text-white mt-0.5">{finalMyScore}</p>
            </div>
          </div>
          <div className="text-center font-bold text-slate-400 text-sm">VS</div>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <img src={getUserAvatarUrl(opponent)} alt={opponent?.displayName || 'Opponent'} className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase truncate max-w-[120px] block">{opponent?.displayName || 'Opponent'}</span>
              <p className="font-bold text-2xl text-slate-600 dark:text-slate-400 mt-0.5">{finalOppScore}</p>
            </div>
          </div>
        </div>

        {/* Reward Metrics */}
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl text-center shadow-xs">
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Rating Change</span>
            <p className={`font-bold text-base sm:text-lg mt-1 ${
              !isDraw && typeof eloVal === 'number' && eloVal > 0 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : !isDraw && typeof eloVal === 'number' && eloVal < 0 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : 'text-slate-600 dark:text-slate-300'
            }`}>
              {eloChange} Elo
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl text-center shadow-xs">
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">XP Earned</span>
            <p className="font-bold text-base sm:text-lg text-purple-600 dark:text-purple-400 mt-1">
              {xpChange} XP
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-xl text-center shadow-xs">
            <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Coins Earned</span>
            <p className="font-bold text-base sm:text-lg text-amber-600 dark:text-amber-400 mt-1">
              {coinsChange}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMatchmakingState('idle');
            setActiveSession(null);
            setMatchError(null);
            setStatus('lounge');
            setSearchParams({});
            setBattleId(null);
            setOpponent(null);
            setQuestions([]);
            setBattleResult(null);
            setPlayerScore(0);
            setPlayerCompletedQuestions(0);
            setOpponentProgress({ progressIndex: 0, score: 0, finished: false });
          }}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm text-white transition-colors cursor-pointer shadow-xs"
        >
          Return to Arena Lounge
        </button>
      </div>
    );
  }

  // State 4: Active Combat Screen
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const PREFIXES = ['A', 'B', 'C', 'D'];

  if (questions.length === 0 || currentIndex >= questions.length) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto space-y-4">
        <div className="w-10 h-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
          Authorizing final evaluation and waiting for competitor...
        </p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion || typeof currentQuestion.questionText !== 'string' || !Array.isArray(currentQuestion.options) || currentQuestion.options.length === 0) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/70 shadow-sm text-center space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Unable to initialize battle</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Question data was incomplete or unavailable.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => {
              if (battleSocket.current && battleId) {
                battleSocket.current.emit('get_battle_state', { battleId });
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
          >
            Retry Initialization
          </button>
          <button
            type="button"
            onClick={handleLeaveLobby}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Return to Battle Arena
          </button>
        </div>
      </div>
    );
  }
  const hasLongOptions = currentQuestion.options.some((opt) => opt.length > 60);
  const myProgressPct = Math.min(100, (playerCompletedQuestions / (questions.length || 1)) * 100);
  const oppProgressPct = Math.min(100, (opponentProgress.progressIndex / (questions.length || 1)) * 100);

  return (
    <div className="w-full max-w-[1120px] mx-auto flex flex-col gap-3 sm:gap-4 pt-1 pb-6 md:pb-4 overflow-x-hidden">
      {/* Floating Status Alerts */}
      <AnimatePresence>
        {battleAlert && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.16 }}
            className={`fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md border max-w-[90vw] truncate ${
              battleAlert.type === 'success' 
                ? 'bg-emerald-600 text-white border-emerald-500' 
                : battleAlert.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-500'
                  : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700'
            }`}
          >
            {battleAlert.text}
          </motion.div>
        )}
      </AnimatePresence>

      {showEntrance && (
        <EntranceEffect 
          type={opponent?.equippedEntrance || userProfile?.equippedEntrance || null} 
          onComplete={() => setShowEntrance(false)} 
        />
      )}

      {/* Battle Information Header */}
      <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-2 sm:px-4 sm:py-3 rounded-xl shadow-xs">
        <button
          onClick={handleLeaveLobby}
          className="shrink-0 flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1.5 sm:px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
        >
          <FaArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span>Exit</span>
        </button>

        <div className="min-w-0 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-slate-200 dark:border-slate-700 whitespace-nowrap truncate">
          Question {currentIndex + 1} of {questions.length}
        </div>

        <div
          className={`shrink-0 font-mono text-[11px] sm:text-xs font-bold px-2.5 py-1.5 sm:px-3 rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            questionTimeLeft <= 5
              ? 'text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/50 animate-pulse'
              : questionTimeLeft <= 10
                ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40'
                : 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40'
          }`}
        >
          <FaRegClock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span>{formatTimer(questionTimeLeft)}</span>
        </div>
      </div>

      {/* Synchronized Player Scoreboard */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 sm:p-3.5 rounded-xl shadow-xs">
        {/* YOU Card */}
        <div className="min-w-0 p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-blue-200/80 dark:border-blue-900/50 space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img
              src={getUserAvatarUrl(userProfile)}
              alt={userProfile?.displayName || 'You'}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full object-cover border border-blue-400/60 shrink-0 bg-slate-200 dark:bg-slate-700"
            />
            <span className="text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 uppercase truncate">
              You
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
              {Math.min(questions.length, playerCompletedQuestions)}/{questions.length}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono">
              {playerScore} pts
            </span>
          </div>
          <div className="w-full h-1.5 sm:h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-600 rounded-full"
              initial={false}
              animate={{ width: `${myProgressPct}%` }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* OPPONENT Card */}
        <div className="min-w-0 p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-purple-200/80 dark:border-purple-900/50 space-y-1.5 sm:space-y-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img
              src={getUserAvatarUrl(opponent || {})}
              alt={opponent?.displayName || 'Opponent'}
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full object-cover border border-purple-400/60 shrink-0 bg-slate-200 dark:bg-slate-700"
            />
            <span className="text-[11px] sm:text-xs font-bold text-purple-600 dark:text-purple-400 uppercase truncate">
              {opponent?.displayName || 'Opponent'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">
              {Math.min(questions.length, opponentProgress.progressIndex)}/{questions.length}
            </span>
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono">
              {opponentProgress.score} pts
            </span>
          </div>
          <div className="w-full h-1.5 sm:h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-600 rounded-full"
              initial={false}
              animate={{ width: `${oppProgressPct}%` }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Question Card & Answer Options */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: prefersReducedMotion ? 0.08 : 0.18, ease: 'easeOut' }}
          className="flex flex-col gap-3 sm:gap-4"
        >
          {/* Question Card (content-based height, no vertical stretching) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 lg:p-7 rounded-xl shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Question {currentIndex + 1}
              </span>
              <div className="flex items-center gap-2">
                {battleFlowState === 'ANSWER_SUBMITTED' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    Evaluating...
                  </span>
                )}
                {battleFlowState === 'ADVANCING_QUESTION' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    Next question...
                  </span>
                )}
                {currentQuestion.difficulty && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {currentQuestion.difficulty}
                  </span>
                )}
              </div>
            </div>
            <h2 className="text-[17px] sm:text-lg lg:text-xl font-semibold text-slate-900 dark:text-white leading-relaxed break-words">
              {currentQuestion.questionText}
            </h2>
          </div>

          {/* Answer Options Grid */}
          <div className={`grid gap-2.5 sm:gap-3 ${hasLongOptions || currentQuestion.options.length !== 4 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = selectedOption === idx;
              const isEvaluated = answerFeedback !== null && answerFeedback.questionIndex === currentIndex;
              const isCorrectOption = isEvaluated && answerFeedback.correctOption === idx;
              const isWrongSelection = isEvaluated && isSelected && !answerFeedback.isCorrect;

              let btnStyle = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80';
              let badgeStyle = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';

              if (isEvaluated) {
                if (isSelected) {
                  if (answerFeedback.isCorrect) {
                    btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/30';
                    badgeStyle = 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 text-emerald-700 dark:text-emerald-300';
                  } else {
                    btnStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-semibold ring-1 ring-rose-500/30';
                    badgeStyle = 'bg-rose-100 dark:bg-rose-900/50 border-rose-500 text-rose-700 dark:text-rose-300';
                  }
                } else if (isCorrectOption) {
                  btnStyle = 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/20';
                  badgeStyle = 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500 text-emerald-700 dark:text-emerald-300';
                } else {
                  btnStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 opacity-55';
                }
              } else if (selectedOption !== null && isSelected) {
                btnStyle = 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold ring-1 ring-blue-500/30';
                badgeStyle = 'bg-blue-100 dark:bg-blue-900/50 border-blue-500 text-blue-700 dark:text-blue-300';
              } else if (selectedOption !== null) {
                btnStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 opacity-55';
              }

              return (
                <motion.button
                  key={idx}
                  type="button"
                  whileTap={selectedOption === null && !isSubmittingAnswer && !prefersReducedMotion ? { scale: 0.99 } : undefined}
                  onClick={() => handleAnswerSubmit(idx)}
                  disabled={selectedOption !== null || isSubmittingAnswer}
                  className={`w-full min-h-[56px] px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-xl border text-left text-sm sm:text-[15px] transition-colors duration-150 flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default shadow-xs ${btnStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${badgeStyle}`}>
                      {PREFIXES[idx]}
                    </span>
                    <span className="leading-snug text-slate-900 dark:text-white font-medium break-words min-w-0">
                      {opt}
                    </span>
                  </div>

                  {isEvaluated && (
                    <div className="shrink-0 ml-1">
                      {isCorrectOption ? (
                        <FaCircleCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : isWrongSelection ? (
                        <FaCircleXmark className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 dark:text-rose-400" />
                      ) : null}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export const Battle: React.FC = () => (
  <BattleErrorBoundary>
    <BattleInner />
  </BattleErrorBoundary>
);

export default Battle;
