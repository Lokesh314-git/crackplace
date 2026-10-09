import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

const CATEGORIES = ['Aptitude', 'DSA', 'DBMS', 'Operating Systems'];

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


export const Battle: React.FC = () => {
  const { token, userProfile, updateProfile } = useAuthStore();

  // Setup Lounge states
  const [selectedCategory, setSelectedCategory] = useState('DSA');
  const [loungeTab, setLoungeTab] = useState<'quick' | 'friend'>('quick');
  const [customSubTab, setCustomSubTab] = useState<'create' | 'join'>('create');
  const [status, setStatus] = useState<'lounge' | 'searching' | 'lobby' | 'battle' | 'concluded'>('lounge');
  const [searchStatusMsg, setSearchStatusMsg] = useState('Searching for opponents...');

  const [searchParams, setSearchParams] = useSearchParams();
  const roomQuery = searchParams.get('room');

  // Lobby States
  const [lobbyRoom, setLobbyRoom] = useState<any | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [lobbyTimeLeft, setLobbyTimeLeft] = useState('30:00');

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
  const [customBattleType, setCustomBattleType] = useState('Aptitude');
  const [questionsCount, setQuestionsCount] = useState(5);
  const [difficulty, setDifficulty] = useState('Medium');
  const [timeLimit, setTimeLimit] = useState(30);
  const [categoryName, setCategoryName] = useState('All');
  const [companyName, setCompanyName] = useState('All');
  const [isPrivate, setIsPrivate] = useState(true);

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
  const [opponentProgress, setOpponentProgress] = useState({ progressIndex: 0, score: 0, finished: false });
  const [battleResult, setBattleResult] = useState<BattleResult | any | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(30);
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

  // 1. Join matchmaking queue
  const handleStartSearch = () => {
    setStatus('searching');
    setSearchStatusMsg('Connecting to matchmaking corridor...');
    
    // Connect to matchmaking namespace with Firebase Auth token
    matchmakingSocket.current = io(`${getSocketUrl()}/matchmaking`, {
      transports: ['websocket'],
      auth: { token }
    });

    matchmakingSocket.current.on('connect', () => {
      setSearchStatusMsg('Searching for active placement candidates...');
      matchmakingSocket.current?.emit('join_lobby', {
        battleType: selectedCategory,
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

    matchmakingSocket.current.on('match_status', (data: { message: string }) => {
      setSearchStatusMsg(data.message);
    });

    matchmakingSocket.current.on('match_found', (data: { battleId: string; opponent: Opponent; quiz: QuizQuestion[] }) => {
      setBattleId(data.battleId);
      setOpponent(data.opponent);
      setQuestions(data.quiz);
      setStatus('battle');
      
      // Clean matchmaking socket
      matchmakingSocket.current?.disconnect();
      matchmakingSocket.current = null;
    });

    matchmakingSocket.current.on('match_error', (data: { message: string }) => {
      alert(data.message);
      handleCancelSearch();
    });
  };

  const handleCancelSearch = () => {
    if (matchmakingSocket.current) {
      matchmakingSocket.current.emit('leave_lobby', { userId: userProfile?.uid });
      matchmakingSocket.current.disconnect();
      matchmakingSocket.current = null;
    }
    setStatus('lounge');
    setSearchParams({});
  };

  const handleLeaveLobby = () => {
    if (battleSocket.current) {
      battleSocket.current.disconnect();
      battleSocket.current = null;
    }
    setStatus('lounge');
    setSearchParams({});
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
          battleType: customBattleType,
          questionsCount,
          difficulty,
          timeLimit,
          category: categoryName,
          company: companyName,
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
    const text = `🔥 I challenge you to a 1v1 battle on CrackPlace AI!\n\nRoom Code: ${lobbyRoom.roomId}\nCategory: ${lobbyRoom.battleType}\nDifficulty: ${lobbyRoom.settings.difficulty}\nQuestions: ${lobbyRoom.settings.questionsCount}\n\nCan you beat me?\n\nJoin here:\n${inviteLink}`;
    
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
            current: myPlayerData?.eloAfter ?? myPlayerData?.elo ?? userProfile?.battleRating ?? 1200,
            change: myPlayerData?.eloChange ?? (myPlayerData?.eloAfter !== undefined && myPlayerData?.eloBefore !== undefined ? myPlayerData.eloAfter - myPlayerData.eloBefore : (outcome === 'WIN' ? 25 : outcome === 'LOSS' ? -20 : 0))
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
      setCurrentIndex(restoredIdx);
      currentIndexRef.current = restoredIdx;

      setSelectedOption(null);
      selectedOptionRef.current = null;
      setAnswerFeedback(null);
      setIsSubmittingAnswer(false);
      isSubmittingRef.current = false;

      if (typeof data.playerScore === 'number') setPlayerScore(data.playerScore);
      setStatus('battle');
      statusRef.current = 'battle';

      if (data.opponentProgress) {
        setOpponentProgress({
          progressIndex: data.opponentProgress.progressIndex || 0,
          score: data.opponentProgress.score || 0,
          finished: data.opponentProgress.finished || false
        });
      }
      setBattleAlert({ text: '🔄 Battle Restored', type: 'info' });
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
      setPlayerScore(data.score);

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

      const ptsStr = (typeof data.pointsAwarded === 'number' && data.pointsAwarded > 0) ? `+${data.pointsAwarded}` : (data.isCorrect ? '+20' : '+0');
      setBattleAlert({
        text: data.isCorrect ? `⚡ Correct! ${ptsStr}` : '❌ Wrong!',
        type: data.isCorrect ? 'success' : 'error'
      });

      setTimeout(() => {
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
      }, 1200);
    };

    const onStepUpdate = (data: { uid: string; score: number; progressIndex: number; finished: boolean }) => {
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
      const limit = lobbyRoom?.settings?.timeLimit || 30;
      setQuestionTimeLeft(limit);

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
  }, [status, currentIndex, selectedOption, questions.length, lobbyRoom]);

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

  // 3. Question submit handler (Server-Authoritative)
  const handleAnswerSubmit = (optionIdx: number) => {
    if (selectedOptionRef.current !== null || isSubmittingRef.current || !battleId) return;
    
    setIsSubmittingAnswer(true);
    isSubmittingRef.current = true;
    setSelectedOption(optionIdx);
    selectedOptionRef.current = optionIdx;

    if (optionIdx === -1) {
      setBattleAlert({ text: '⏳ Time Out!', type: 'error' });
    }

    // Send authoritative submission to backend
    battleSocket.current?.emit('submit_answer', {
      battleId,
      questionIndex: currentIndexRef.current,
      selectedOption: optionIdx
    });
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
                <div>
                  <h3 className="font-semibold text-base text-slate-900 dark:text-white">
                    Select Assessment Subject
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Choose a category to automatically find an opponent of matching skill level.</p>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  {CATEGORIES.map(cat => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-xs ring-1 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">{cat}</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-700 bg-transparent'
                          }`}>
                            {isSelected ? '✓' : ''}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Standard 5-Question Format</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                    <FaRegClock className="w-4 h-4" />
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-medium text-slate-900 dark:text-white">Matchmaking Criteria</p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">Matches are paired within ±100 Elo rating. Answers are evaluated server-side with strict latency tolerance and speed bonuses.</p>
                  </div>
                </div>

                <button
                  onClick={handleStartSearch}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold text-sm tracking-wide text-white shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                >
                  <FaPlay className="w-3.5 h-3.5" />
                  <span>Find Competitor</span>
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
                      {/* Battle Type */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Topic Domain</label>
                        <select
                          value={customBattleType}
                          onChange={e => setCustomBattleType(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        >
                          <option value="Aptitude">Quantitative Aptitude</option>
                          <option value="DSA">Data Structures & Algorithms</option>
                          <option value="DBMS">Database Management</option>
                          <option value="Operating Systems">Operating Systems</option>
                          <option value="HR">HR Interview Concepts</option>
                          <option value="Rapid Fire">Rapid Fire Mixed</option>
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
                        </select>
                      </div>

                      {/* Time limit */}
                      <div className="space-y-1.5">
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

                      {/* Category */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Subtopic Filter</label>
                        <input
                          type="text"
                          value={categoryName}
                          onChange={e => setCategoryName(e.target.value)}
                          placeholder="e.g. Dynamic Programming, Trees"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        />
                      </div>

                      {/* Company */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Company Pattern</label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={e => setCompanyName(e.target.value)}
                          placeholder="e.g. TCS, Amazon, Infosys"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-hidden focus:border-blue-600"
                        />
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
                      disabled={isCreatingRoom}
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
      alert('Battle invite link copied to clipboard!');
    };

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-16 text-slate-900 dark:text-white">
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
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Code: <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{lobbyRoom.roomId}</span></p>
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl space-y-6 shadow-xs">
          <div className="grid grid-cols-3 items-center gap-4">
            {/* Host Card */}
            <div className="flex flex-col items-center text-center space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase">
                {lobbyRoom.hostUid === userProfile?.uid ? 'You (Host)' : 'Host'}
              </span>
              <div className="relative w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-base font-bold text-slate-800 dark:text-white">
                <img src={getUserAvatarUrl(host)} alt={host?.displayName || 'Host'} className="w-full h-full object-cover rounded-full" />
                {lobbyRoom.hostUid === userProfile?.uid && activeEmote && (
                  <div className="absolute -top-6 -right-2 text-3xl animate-bounce z-10 drop-shadow-md">
                    {activeEmote === 'emote_gg' || activeEmote === 'gg' ? '🎮' : 
                     activeEmote === 'emote_rip' || activeEmote === 'rip' ? '💀' : 
                     activeEmote === 'emote_sweat' || activeEmote === 'sweat' ? '😅' : '🔥'}
                  </div>
                )}
              </div>
              <div className="w-full">
                <h3 className="font-semibold text-xs text-slate-900 dark:text-white truncate">{host?.displayName}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Rating: {host?.battleRating || 1200}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
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

            {/* VS Divider */}
            <div className="flex flex-col items-center text-center">
              <span className="font-bold text-2xl text-slate-400">VS</span>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Invite Code</span>
                <button 
                  onClick={handleLocalCopy}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mt-0.5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <span>{lobbyRoom.roomId}</span>
                  <FaCopy className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Guest Card */}
            <div className="flex flex-col items-center text-center space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold tracking-wider text-purple-600 dark:text-purple-400 uppercase">
                {lobbyRoom.hostUid === userProfile?.uid ? 'Opponent' : 'You (Candidate)'}
              </span>
              {guest ? (
                <>
                  <div className="relative w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-base font-bold text-slate-800 dark:text-white">
                    <img src={getUserAvatarUrl(guest)} alt={guest.displayName || 'Guest'} className="w-full h-full object-cover rounded-full" />
                    {lobbyRoom.guestUid === userProfile?.uid && activeEmote && (
                      <div className="absolute -top-6 -right-2 text-3xl animate-bounce z-10 drop-shadow-md">
                        {activeEmote === 'emote_gg' || activeEmote === 'gg' ? '🎮' : 
                         activeEmote === 'emote_rip' || activeEmote === 'rip' ? '💀' : 
                         activeEmote === 'emote_sweat' || activeEmote === 'sweat' ? '😅' : '🔥'}
                      </div>
                    )}
                  </div>
                  <div className="w-full">
                    <h3 className="font-semibold text-xs text-slate-900 dark:text-white truncate">{guest.displayName}</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Rating: {guest.battleRating}</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
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
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-400">
                    ?
                  </div>
                  <div className="w-full">
                    <h3 className="font-semibold text-xs text-slate-400 italic">Waiting...</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Awaiting link click</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Invite Sharing Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-4 shadow-xs">
          <div>
            <h2 className="font-semibold text-sm text-slate-900 dark:text-white">Share Invitation Link</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Send this link to anyone to immediately match in this room.</p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-blue-600 dark:text-blue-400 font-mono focus:outline-hidden"
            />
            <button
              onClick={handleLocalCopy}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FaCopy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
            <button
              onClick={handleShareInvite}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FaWhatsapp className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
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
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-5 animate-fade-in max-w-md mx-auto text-center px-4">
        <div className="w-12 h-12 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
        <div className="space-y-1">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">Matchmaking Active</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            {searchStatusMsg}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 w-full shadow-xs">
          <span>Target Elo Range: </span>
          <span className="font-semibold text-slate-900 dark:text-white">{(userProfile?.battleRating || 1200) - 100} — {(userProfile?.battleRating || 1200) + 100}</span>
        </div>

        <button
          onClick={handleCancelSearch}
          className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          Cancel Queue
        </button>
      </div>
    );
  }

  // State 3: Assessment Concluded / Scorecard
  if (status === 'concluded' && battleResult) {
    const isMeWinner = battleResult.winnerId === userProfile?.uid || battleResult.playerReward?.outcome === 'WIN';
    const isDraw = battleResult.isDraw || battleResult.winnerId === 'draw' || battleResult.playerReward?.outcome === 'DRAW';

    let outcomeTitle = 'Assessment Tied';
    let outcomeBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

    const playerReward = battleResult.playerReward;
    const opponentReward = battleResult.opponentReward;
    const myDeltas = (battleResult as any).playerDeltas?.[userProfile?.uid || ''];

    const finalMyScore = playerReward?.score ?? myDeltas?.score ?? playerScore;
    const finalOppScore = playerReward?.opponentScore ?? opponentReward?.score ?? opponentProgress.score;

    const eloVal = playerReward?.elo?.change ?? myDeltas?.elo;
    const xpVal = playerReward?.xp?.earned ?? myDeltas?.xp;
    const coinsVal = playerReward?.coins?.earned ?? myDeltas?.coins;

    let eloChange = eloVal !== undefined ? (eloVal >= 0 ? `+${eloVal}` : `${eloVal}`) : '+0';
    let coinsChange = coinsVal !== undefined ? `+${coinsVal}` : '+0';
    let xpChange = xpVal !== undefined ? `+${xpVal}` : '+0';

    if (!isDraw) {
      if (isMeWinner) {
        outcomeTitle = 'Victory — Assessment Won';
        outcomeBadge = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      } else {
        outcomeTitle = 'Defeat — Good Attempt';
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
            <p className={`font-bold text-base sm:text-lg mt-1 ${typeof eloVal === 'number' && eloVal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
            setStatus('lounge');
            setBattleId(null);
            setOpponent(null);
            setQuestions([]);
            setBattleResult(null);
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

  return (
    <div className="max-w-4xl mx-auto flex flex-col justify-between min-h-[85vh] py-2 space-y-6">
      {/* Floating Status Alerts */}
      <AnimatePresence>
        {battleAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-md border ${
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

      {/* Top row controls */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
        <button
          onClick={handleLeaveLobby}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <FaArrowLeft className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
        
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
          Question {currentIndex + 1} of {questions.length}
        </div>
        
        <div className={`font-mono text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
          questionTimeLeft <= 5 
            ? 'text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 animate-pulse' 
            : 'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40'
        }`}>
          <FaRegClock className="w-3.5 h-3.5" />
          <span>{formatTimer(questionTimeLeft)}</span>
        </div>
      </div>

      {/* Synchronized Score & Progress HUD */}
      <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl shadow-xs">
        {/* YOU Card */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">You</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{playerScore} pts</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300 rounded-full" 
              style={{ width: `${(currentIndex / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* OPPONENT Card */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase truncate max-w-[90px]">{opponent?.displayName || 'Opponent'}</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{opponentProgress.score} pts</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-600 transition-all duration-300 rounded-full" 
              style={{ width: `${(opponentProgress.progressIndex / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 rounded-xl shadow-xs flex-1 flex flex-col justify-center">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white leading-relaxed">
          {questions[currentIndex].questionText}
        </h2>
      </div>

      {/* Answer Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {questions[currentIndex].options.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          const isEvaluated = answerFeedback !== null && answerFeedback.questionIndex === currentIndex;
          const isCorrectOption = isEvaluated && answerFeedback.correctOption === idx;
          const isWrongSelection = isEvaluated && isSelected && !answerFeedback.isCorrect;

          let btnStyle = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800';
          let badgeStyle = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400';

          if (isEvaluated) {
            if (isSelected) {
              if (answerFeedback.isCorrect) {
                btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-500/30';
                badgeStyle = 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-700 dark:text-emerald-300';
              } else {
                btnStyle = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-semibold ring-1 ring-rose-500/30';
                badgeStyle = 'bg-rose-100 dark:bg-rose-900/40 border-rose-500 text-rose-700 dark:text-rose-300';
              }
            } else if (isCorrectOption) {
              // Highlight the actual correct option in emerald if candidate selected wrong
              btnStyle = 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/20';
              badgeStyle = 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-700 dark:text-emerald-300';
            } else {
              btnStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 opacity-50';
            }
          } else if (selectedOption !== null && isSelected) {
            // Selected, waiting for server evaluation
            btnStyle = 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-semibold ring-1 ring-blue-500/30';
            badgeStyle = 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 text-blue-700 dark:text-blue-300';
          } else if (selectedOption !== null) {
            btnStyle = 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-slate-400 opacity-50';
          }

          return (
            <button
              key={idx}
              onClick={() => handleAnswerSubmit(idx)}
              disabled={selectedOption !== null || isSubmittingAnswer}
              className={`min-h-[58px] p-4 rounded-xl border text-left text-sm transition-all duration-150 flex items-center justify-between cursor-pointer disabled:cursor-default shadow-xs ${btnStyle}`}
            >
              <div className="flex items-center gap-3 pr-2">
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 ${badgeStyle}`}>
                  {PREFIXES[idx]}
                </span>
                <span className="leading-snug text-slate-900 dark:text-white font-medium">{opt}</span>
              </div>

              {isEvaluated && (
                <div className="shrink-0 ml-2">
                  {isCorrectOption ? (
                    <FaCircleCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : isWrongSelection ? (
                    <FaCircleXmark className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600 dark:text-rose-400" />
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Battle;
