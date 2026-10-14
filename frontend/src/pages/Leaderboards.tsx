import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FaCrown, FaMagnifyingGlass, FaArrowRotateRight, FaCircleExclamation, FaTrophy, FaLock, FaRegClock, FaBolt, FaGraduationCap } from 'react-icons/fa6';
import { getUserAvatarUrl, getAvatarImageUrl, SYSTEM_DEFAULT_AVATAR_VISUAL } from '../utils/avatarResolver';
import { checkIsLegendaryPlayer } from '../config/cosmetics';
import { ProfilePreviewModal } from '../components/profile/ProfilePreviewModal';
import type { ProfilePreviewData } from '../components/profile/ProfilePreviewModal';
import { calculateLevelFromXP } from '../utils/levelCalculator';

interface LeaderboardUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  equippedAvatar?: string | null;
  avatar?: string | null;
  level: number;
  battleRating: number;
  xp: number;
  totalXp: number;
  weeklyXp?: number;
  rank?: number;
  equippedRing?: string | null;
  equippedFrame?: string | null;
  equippedTitle?: string | null;
  college?: string | null;
  isLegendaryPlayer?: boolean;
  accountStatus?: string;
  isDeleted?: boolean;
}

interface SeasonInfo {
  seasonId: string;
  seasonNumber: number;
  startDate: string;
  endDate: string;
  nextResetTimestamp: string;
  timeRemainingMs: number;
  reductionPercentage: number;
  decayEnabled: boolean;
  timezone: string;
}

interface LeaderboardLockDetails {
  locked: boolean;
  message: string;
  currentLevel: number;
  requiredLevel: number;
  currentXp: number;
  requiredXpForLevel3: number;
  xpNeeded: number;
  progressPercentage: number;
}

export const Leaderboards: React.FC = () => {
  const { token, userProfile } = useAuthStore();
  const [ranks, setRanks] = useState<LeaderboardUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'global' | 'weekly'>('global');

  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Season countdown state
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');

  // Lock state for users below Level 3
  const [lockDetails, setLockDetails] = useState<LeaderboardLockDetails | null>(null);

  const fetchSeasonDetails = useCallback(async () => {
    try {
      const res = await fetch('/api/seasons/current');
      if (res.ok) {
        const data = await res.json();
        setSeasonInfo(data);
      }
    } catch {
      // Non-fatal fallback
    }
  }, []);

  useEffect(() => {
    fetchSeasonDetails();
  }, [fetchSeasonDetails]);

  const handleUserClick = (user: LeaderboardUser, actualRank: number) => {
    setSelectedUser({ ...user, rank: actualRank });
    setIsModalOpen(true);
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    const fallback = getAvatarImageUrl(SYSTEM_DEFAULT_AVATAR_VISUAL);
    if (target.src !== fallback) {
      target.src = fallback;
    }
  };

  const fetchLeaderboard = useCallback(async (selectedTab: 'global' | 'weekly') => {
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/leaderboard?type=${selectedTab}`, { headers });
      const data = await res.json();

      if (!res.ok) {
        if (data.locked || data.code === 'LEADERBOARD_LOCKED') {
          setLockDetails({
            locked: true,
            message: data.message || 'Reach Level 3 to unlock competitive rankings.',
            currentLevel: data.currentLevel || 1,
            requiredLevel: data.requiredLevel || 3,
            currentXp: data.currentXp || 0,
            requiredXpForLevel3: data.requiredXpForLevel3 || 250,
            xpNeeded: data.xpNeeded || 250,
            progressPercentage: data.progressPercentage || 0
          });
          setRanks([]);
          setLoading(false);
          return;
        }

        const errorMsg = typeof data.error === 'object' && data.error !== null 
          ? (data.error.message || JSON.stringify(data.error)) 
          : data.error;
        throw new Error(errorMsg || 'Failed to load leaderboard data.');
      }

      setLockDetails(null);

      const rawUserList: LeaderboardUser[] = Array.isArray(data) ? data : (data.users || []);
      // Defense-in-depth: Exclude any soft-deleted, tombstoned, or blocked accounts and guarantee sequential ranks
      const sanitizedUsers = rawUserList
        .filter((u) => {
          if (!u || !u.uid) return false;
          if (u.accountStatus === 'deleted' || u.accountStatus === 'blocked' || u.isDeleted) return false;
          const name = (u.displayName || '').trim().toLowerCase();
          if (name === 'deleted user' || name === '[deleted]' || name === 'deleted_user') return false;
          return true;
        })
        .map((u, idx) => ({
          ...u,
          rank: idx + 1
        }));

      setRanks(sanitizedUsers);
    } catch (err: any) {
      console.error('Leaderboard fetch error:', err);
      setError(err.message || 'Unable to load rankings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setExpanded(false); // Reset expansion when tab changes
    fetchLeaderboard(tab);
  }, [tab, fetchLeaderboard]);

  // Second-by-second countdown ticker for active season
  useEffect(() => {
    if (!seasonInfo?.nextResetTimestamp) return;

    const updateCountdown = () => {
      const end = new Date(seasonInfo.nextResetTimestamp).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setCountdownText('Resetting season...');
        fetchSeasonDetails();
        fetchLeaderboard(tab);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setCountdownText(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdownText(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdownText(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [seasonInfo, fetchSeasonDetails, fetchLeaderboard, tab]);

  // Listen for battle/XP completion events to refresh leaderboard live
  useEffect(() => {
    const handleRefresh = () => {
      fetchLeaderboard(tab);
    };

    window.addEventListener('xp-earned', handleRefresh);
    window.addEventListener('level-up', handleRefresh);
    window.addEventListener('battle-completed', handleRefresh);

    return () => {
      window.removeEventListener('xp-earned', handleRefresh);
      window.removeEventListener('level-up', handleRefresh);
      window.removeEventListener('battle-completed', handleRefresh);
    };
  }, [tab, fetchLeaderboard]);

  const filteredRanks = ranks.filter(r => {
    const name = (r.displayName || '').trim().toLowerCase();
    if (name === 'deleted user' || name === '[deleted]' || r.accountStatus === 'deleted' || r.isDeleted) {
      return false;
    }
    return name.includes(search.toLowerCase());
  });

  const topThree = filteredRanks.slice(0, 3);
  const remainingAll = filteredRanks.slice(3);
  const showMoreThreshold = 25;
  const isExpandable = remainingAll.length > (showMoreThreshold - 3) && !search;
  
  // Show all if expanded or searching. Otherwise show up to 25 top users total (so 22 in remaining)
  const remaining = (expanded || search) 
    ? remainingAll 
    : remainingAll.slice(0, showMoreThreshold - 3);

  const currentUserRankIndex = userProfile ? ranks.findIndex(r => r.uid === userProfile.uid) : -1;
  const currentUserRankDisplay = currentUserRankIndex >= 0 ? `#${currentUserRankIndex + 1}` : 'Unranked';

  const isUserLocked = Boolean(
    lockDetails?.locked ||
    (userProfile && (userProfile.level || 1) < 3 && userProfile.role !== 'admin')
  );

  const displayCurrentLevel = lockDetails?.currentLevel ?? userProfile?.level ?? 1;
  const displayCurrentXp = lockDetails?.currentXp ?? userProfile?.xp ?? 0;
  const displayTargetXp = lockDetails?.requiredXpForLevel3 ?? 250;
  const displayXpNeeded = lockDetails?.xpNeeded ?? Math.max(0, displayTargetXp - displayCurrentXp);
  const displayProgressPct = lockDetails?.progressPercentage ?? Math.min(100, Math.round((displayCurrentXp / displayTargetXp) * 100));

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border-dark">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Placement Standings</span>
            {seasonInfo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-[11px] font-semibold text-brand-400">
                <FaRegClock className="w-3 h-3 shrink-0" />
                <span>Season {seasonInfo.seasonNumber || 1} ends in:</span>
                <span className="font-mono font-bold text-text-primary">{countdownText || 'Calculating...'}</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mt-1">Global Rankings</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {tab === 'global' 
              ? 'Top performing placement candidates ranked by competitive Elo and total XP.' 
              : 'Weekly sprint contenders ranked by practice XP earned since Monday.'}
          </p>
        </div>

        {/* Tab & Refresh selector */}
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-dark border border-border-dark p-1 rounded-xl shadow-xs">
            <button
              onClick={() => setTab('global')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === 'global' 
                  ? 'bg-brand-600 text-white shadow-xs' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All-Time Global
            </button>
            <button
              onClick={() => setTab('weekly')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === 'weekly' 
                  ? 'bg-brand-600 text-white shadow-xs' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Weekly Sprint
            </button>
          </div>

          <button
            onClick={() => fetchLeaderboard(tab)}
            title="Refresh Rankings"
            disabled={loading}
            className="p-2.5 rounded-xl bg-surface-dark border border-border-dark hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
          >
            <FaArrowRotateRight className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <FaCircleExclamation className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchLeaderboard(tab)}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold cursor-pointer transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 py-8">
          <div className="h-28 bg-surface-dark border border-border-dark rounded-2xl animate-pulse"></div>
          <div className="h-14 bg-surface-dark border border-border-dark rounded-xl animate-pulse"></div>
          <div className="h-14 bg-surface-dark border border-border-dark rounded-xl animate-pulse"></div>
          <div className="h-14 bg-surface-dark border border-border-dark rounded-xl animate-pulse"></div>
        </div>
      ) : isUserLocked ? (
        /* Dedicated Locked Screen for Level < 3 */
        <div className="bg-surface-dark border border-border-dark p-8 sm:p-12 rounded-2xl text-center space-y-6 shadow-xs max-w-xl mx-auto my-8 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 text-2xl shadow-inner">
            <FaLock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Leaderboard Locked</h2>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Reach <span className="font-semibold text-brand-400">Level 3</span> to unlock competitive rankings.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border-dark space-y-3 text-left">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted font-medium">Progression to Unlocking</span>
              <span className="font-semibold text-text-primary">
                Level {displayCurrentLevel} / 3
              </span>
            </div>

            <div className="w-full bg-surface-dark h-2.5 rounded-full overflow-hidden border border-border-dark">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, displayProgressPct))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>{displayCurrentXp} XP earned</span>
              <span className="text-brand-400 font-semibold">{displayXpNeeded} XP needed to reach Level 3</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/practice"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <FaGraduationCap className="w-4 h-4" />
              <span>Continue Practicing</span>
            </Link>
            <Link
              to="/battle"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-border-dark text-text-primary font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <FaBolt className="w-3.5 h-3.5 text-brand-400" />
              <span>Battle Arena</span>
            </Link>
          </div>
        </div>
      ) : ranks.length === 0 && !error ? (
        /* Empty database state */
        <div className="bg-surface-dark border border-border-dark p-12 rounded-2xl text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 mx-auto rounded-full bg-surface-elevated border border-border-dark flex items-center justify-center text-brand-400 text-2xl">
            <FaTrophy className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-text-primary">No Ranked Candidates Yet</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              Complete a 1v1 battle, coding challenge, or practice quiz to claim the #1 spot on the leaderboard!
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {search === '' && topThree.length > 0 && (
            <div className={`grid grid-cols-1 ${topThree.length === 1 ? 'sm:grid-cols-1 max-w-xs mx-auto' : topThree.length === 2 ? 'sm:grid-cols-2 max-w-lg mx-auto' : 'sm:grid-cols-3'} gap-3.5 pt-2`}>
              {topThree.map((user, idx) => {
                const rankNum = idx + 1;
                const isFirst = idx === 0;
                const isCurrentUser = userProfile && user.uid === userProfile.uid;
                const isLegendary = isCurrentUser ? checkIsLegendaryPlayer(userProfile) : user.isLegendaryPlayer;
                return (
                  <div
                    key={user.uid}
                    onClick={() => handleUserClick(user, rankNum)}
                    className={`p-4 rounded-2xl border text-center relative flex flex-col justify-between items-center shadow-xs transition-all cursor-pointer ${
                      isLegendary
                        ? 'border-yellow-400/80 bg-yellow-950/10 shadow-[0_0_15px_rgba(250,204,21,0.15)] ring-1 ring-yellow-400/50 hover:bg-yellow-900/20'
                        : isFirst 
                          ? 'border-amber-500/40 bg-surface-dark ring-1 ring-amber-500/20 hover:bg-surface-elevated/40' 
                          : idx === 1
                            ? 'border-slate-500/30 bg-surface-dark hover:bg-surface-elevated/40'
                            : 'border-amber-700/30 bg-surface-dark hover:bg-surface-elevated/40'
                    } ${isFirst ? 'sm:-translate-y-1' : ''}`}
                  >
                    <div className="flex flex-col items-center w-full mb-2 space-y-1">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${
                          isFirst 
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                            : idx === 1 
                              ? 'bg-slate-400/10 text-slate-300 border border-slate-400/20'
                              : 'bg-amber-700/10 text-amber-500 border border-amber-700/20'
                        }`}>
                          Rank #{rankNum}
                        </span>
                        {isFirst && <FaCrown className="w-4 h-4 text-amber-400" />}
                      </div>
                      {isLegendary && (
                        <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-500/30 self-start">
                          <FaCrown className="w-2.5 h-2.5" /> LEGENDARY PLAYER
                        </div>
                      )}
                    </div>

                    <div className={`w-12 h-12 rounded-full overflow-hidden bg-surface-elevated flex items-center justify-center font-bold text-sm text-text-primary mb-2 ${
                      isLegendary ? 'border-2 border-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]' : 'border border-border-dark'
                    }`}>
                      <img src={getUserAvatarUrl(user)} alt={user.displayName || 'Cadet'} onError={handleAvatarError} className="w-full h-full object-cover" />
                    </div>

                    <div className="w-full">
                      <h4 className="font-semibold text-sm text-text-primary truncate">{user.displayName || 'Cadet'}</h4>
                      <p className="text-[11px] text-text-muted mt-0.5">Level {calculateLevelFromXP(user.xp || user.totalXp || 0)} Candidate</p>
                    </div>

                    <div className="w-full pt-3 mt-3 border-t border-border-dark flex justify-between items-center text-xs">
                      <span className="text-text-muted font-mono">
                        {tab === 'weekly' ? `${user.weeklyXp || 0} XP` : `${user.xp || user.totalXp || 0} XP`}
                      </span>
                      <span className="font-bold text-brand-400 font-mono">{user.battleRating} Elo</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3.5 flex items-center text-text-muted">
              <FaMagnifyingGlass className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search candidate by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-dark border border-border-dark rounded-xl text-xs sm:text-sm text-text-primary focus:outline-hidden focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Active User Rank Highlight Banner */}
          {userProfile && !search && (() => {
            const isLegendary = checkIsLegendaryPlayer(userProfile);
            return (
              <div 
                onClick={() => handleUserClick({
                  ...userProfile,
                  battleRating: userProfile.battleRating || 1200,
                  totalXp: userProfile.xp,
                  isLegendaryPlayer: isLegendary
                } as LeaderboardUser, currentUserRankIndex >= 0 ? currentUserRankIndex + 1 : 0)}
                className={`p-3.5 rounded-xl border flex items-center justify-between shadow-xs cursor-pointer transition-colors ${
                  isLegendary
                    ? 'border-yellow-400/60 bg-yellow-950/20 text-text-primary hover:bg-yellow-900/30 shadow-[0_0_10px_rgba(250,204,21,0.1)]'
                    : 'border-brand-500/30 bg-brand-500/5 text-text-primary hover:bg-brand-500/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-xs font-mono w-10 text-center ${isLegendary ? 'text-yellow-400' : 'text-brand-400'}`}>
                    {currentUserRankDisplay}
                  </span>
                  <div className={`w-8 h-8 rounded-full overflow-hidden bg-surface-elevated flex items-center justify-center font-bold text-xs ${
                    isLegendary ? 'border-2 border-yellow-400 shadow-[0_0_5px_rgba(250,204,21,0.5)]' : 'border border-border-dark'
                  }`}>
                    <img src={getUserAvatarUrl(userProfile)} alt={userProfile.displayName || 'Cadet'} onError={handleAvatarError} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-text-primary">
                      {userProfile.displayName || 'Cadet'} <span className={`${isLegendary ? 'text-yellow-400' : 'text-brand-400'} font-normal`}>(You)</span>
                    </h4>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-text-muted">Level {userProfile.level} • {userProfile.xp} XP</p>
                      {isLegendary && (
                        <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/20 px-1 rounded flex items-center gap-1 border border-yellow-500/30">
                          <FaCrown className="w-2 h-2" /> LEGENDARY
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={`font-bold text-sm font-mono ${isLegendary ? 'text-yellow-400' : 'text-brand-400'}`}>
                  {userProfile.battleRating} Elo
                </div>
              </div>
            );
          })()}

          {/* Rankings Table */}
          <div className="bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-xs divide-y divide-border-dark">
            <div className="p-3 bg-surface-elevated/40 text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 text-center">Rank</span>
                <span>Candidate</span>
              </div>
              <div className="flex items-center gap-8 pr-2">
                <span className="hidden sm:inline">{tab === 'weekly' ? 'Weekly XP' : 'Experience'}</span>
                <span>Rating</span>
              </div>
            </div>

            {(search ? filteredRanks : remaining).map((user, idx) => {
              const actualRank = ranks.findIndex(r => r.uid === user.uid) + 1;
              const isCurrentUser = user.uid === userProfile?.uid;
              const isLegendary = isCurrentUser && userProfile ? checkIsLegendaryPlayer(userProfile) : user.isLegendaryPlayer;
              return (
                <div
                  key={user.uid}
                  onClick={() => handleUserClick(user, actualRank || idx + 4)}
                  className={`p-3 transition-colors flex items-center justify-between text-xs cursor-pointer ${
                    isLegendary
                      ? isCurrentUser ? 'bg-yellow-950/30 hover:bg-yellow-900/40 border-l-2 border-yellow-400' : 'bg-yellow-950/10 hover:bg-yellow-900/20 border-l-2 border-yellow-400/50'
                      : isCurrentUser 
                        ? 'bg-brand-500/5 hover:bg-brand-500/10 border-l-2 border-brand-500' 
                        : 'hover:bg-surface-elevated/40 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 font-mono font-bold text-text-muted text-center shrink-0">
                      #{actualRank || idx + 4}
                    </span>
                    <div className={`w-7 h-7 rounded-full overflow-hidden bg-surface-elevated flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      isLegendary ? 'border border-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.5)]' : 'border border-border-dark'
                    }`}>
                      <img src={getUserAvatarUrl(user)} alt={user.displayName || 'Cadet'} onError={handleAvatarError} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-text-primary truncate max-w-[140px] sm:max-w-[240px]">
                        {user.displayName || 'Cadet'} {isCurrentUser && <span className={`${isLegendary ? 'text-yellow-400' : 'text-brand-400'} font-normal`}>(You)</span>}
                      </h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-text-muted">Level {calculateLevelFromXP(user.xp || user.totalXp || 0)}</p>
                        {isLegendary && (
                          <span className="text-[8px] font-bold text-yellow-400 bg-yellow-500/20 px-1 rounded flex items-center gap-0.5 border border-yellow-500/30">
                            <FaCrown className="w-2 h-2" /> LEGEND
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 shrink-0 pr-2">
                    <span className="text-text-muted font-mono hidden sm:inline">
                      {tab === 'weekly' ? `${user.weeklyXp || 0} XP` : `${user.xp || user.totalXp || 0} XP`}
                    </span>
                    <span className="font-bold text-text-primary font-mono">{user.battleRating} Elo</span>
                  </div>
                </div>
              );
            })}

            {filteredRanks.length === 0 && (
              <div className="text-center py-12 text-xs text-text-muted">
                No matching candidates found in rankings.
              </div>
            )}
          </div>
          
          {isExpandable && !expanded && (
            <div className="flex justify-center mt-6">
              <button 
                onClick={() => setExpanded(true)}
                className="px-6 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-border-dark text-sm font-semibold text-text-primary transition-colors cursor-pointer shadow-xs"
              >
                Show More
              </button>
            </div>
          )}
          
          {expanded && !search && remainingAll.length > (showMoreThreshold - 3) && (
            <div className="flex justify-center mt-6">
              <span className="text-xs font-semibold text-text-muted tracking-wide uppercase">
                Showing Top {ranks.length} Players
              </span>
            </div>
          )}
        </>
      )}

      {/* Profile Preview Modal */}
      <ProfilePreviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        uid={selectedUser?.uid || null}
        initialData={selectedUser ? {
          displayName: selectedUser.displayName,
          level: selectedUser.level,
          battleRating: selectedUser.battleRating,
          rank: selectedUser.rank,
          photoURL: selectedUser.photoURL,
          equippedAvatar: selectedUser.equippedAvatar,
          xp: tab === 'weekly' ? selectedUser.weeklyXp : selectedUser.xp || selectedUser.totalXp,
          college: selectedUser.college || '',
          isLegendaryPlayer: selectedUser.isLegendaryPlayer
        } as Partial<ProfilePreviewData> : undefined}
      />
    </div>
  );
};

export default Leaderboards;
