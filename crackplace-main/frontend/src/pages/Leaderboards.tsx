import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaCrown, FaMagnifyingGlass, FaArrowRotateRight, FaCircleExclamation, FaTrophy } from 'react-icons/fa6';
import { getUserAvatarUrl, getAvatarImageUrl, SYSTEM_DEFAULT_AVATAR_VISUAL } from '../utils/avatarResolver';
import { ProfilePreviewModal } from '../components/profile/ProfilePreviewModal';
import type { ProfilePreviewData } from '../components/profile/ProfilePreviewModal';

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
        throw new Error(data.error || 'Failed to load leaderboard data.');
      }

      const userList = Array.isArray(data) ? data : (data.users || []);
      setRanks(userList);
    } catch (err: any) {
      console.error('Leaderboard fetch error:', err);
      setError(err.message || 'Unable to load rankings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLeaderboard(tab);
  }, [tab, fetchLeaderboard]);

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

  const filteredRanks = ranks.filter(r => 
    (r.displayName || '').toLowerCase().includes(search.toLowerCase())
  );

  const topThree = filteredRanks.slice(0, 3);
  const remaining = filteredRanks.slice(3);

  const currentUserRankIndex = userProfile ? ranks.findIndex(r => r.uid === userProfile.uid) : -1;
  const currentUserRankDisplay = currentUserRankIndex >= 0 ? `#${currentUserRankIndex + 1}` : 'Unranked';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border-dark">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Placement Standings</span>
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
                return (
                  <div
                    key={user.uid}
                    onClick={() => handleUserClick(user, rankNum)}
                    className={`p-4 rounded-2xl border text-center relative flex flex-col justify-between items-center shadow-xs transition-all cursor-pointer ${
                      isFirst 
                        ? 'border-amber-500/40 bg-surface-dark ring-1 ring-amber-500/20 sm:-translate-y-1 hover:bg-surface-elevated/40' 
                        : idx === 1
                          ? 'border-slate-500/30 bg-surface-dark hover:bg-surface-elevated/40'
                          : 'border-amber-700/30 bg-surface-dark hover:bg-surface-elevated/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
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

                    <div className="w-12 h-12 rounded-full overflow-hidden bg-surface-elevated border border-border-dark flex items-center justify-center font-bold text-sm text-text-primary mb-2">
                      <img src={getUserAvatarUrl(user)} alt={user.displayName || 'Cadet'} onError={handleAvatarError} className="w-full h-full object-cover" />
                    </div>

                    <div className="w-full">
                      <h4 className="font-semibold text-sm text-text-primary truncate">{user.displayName || 'Cadet'}</h4>
                      <p className="text-[11px] text-text-muted mt-0.5">Level {user.level} Candidate</p>
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
          {userProfile && !search && (
            <div 
              onClick={() => handleUserClick({
                ...userProfile,
                battleRating: userProfile.battleRating || 1200,
                totalXp: userProfile.xp,
              } as LeaderboardUser, currentUserRankIndex >= 0 ? currentUserRankIndex + 1 : 0)}
              className="p-3.5 rounded-xl border border-brand-500/30 bg-brand-500/5 text-text-primary flex items-center justify-between shadow-xs cursor-pointer hover:bg-brand-500/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-xs text-brand-400 font-mono w-10 text-center">
                  {currentUserRankDisplay}
                </span>
                <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-elevated border border-border-dark flex items-center justify-center font-bold text-xs">
                  <img src={getUserAvatarUrl(userProfile)} alt={userProfile.displayName || 'Cadet'} onError={handleAvatarError} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-text-primary">
                    {userProfile.displayName || 'Cadet'} <span className="text-brand-400 font-normal">(You)</span>
                  </h4>
                  <p className="text-[10px] text-text-muted">Level {userProfile.level} • {userProfile.xp} XP</p>
                </div>
              </div>
              <div className="font-bold text-sm text-brand-400 font-mono">
                {userProfile.battleRating} Elo
              </div>
            </div>
          )}

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
              return (
                <div
                  key={user.uid}
                  onClick={() => handleUserClick(user, actualRank || idx + 4)}
                  className={`p-3 transition-colors flex items-center justify-between text-xs cursor-pointer ${
                    isCurrentUser 
                      ? 'bg-brand-500/5 hover:bg-brand-500/10' 
                      : 'hover:bg-surface-elevated/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 font-mono font-bold text-text-muted text-center shrink-0">
                      #{actualRank || idx + 4}
                    </span>
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-surface-elevated border border-border-dark flex items-center justify-center font-bold text-[10px] shrink-0">
                      <img src={getUserAvatarUrl(user)} alt={user.displayName || 'Cadet'} onError={handleAvatarError} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-text-primary truncate max-w-[140px] sm:max-w-[240px]">
                        {user.displayName || 'Cadet'} {isCurrentUser && <span className="text-brand-400 font-normal">(You)</span>}
                      </h4>
                      <p className="text-[10px] text-text-muted">Level {user.level}</p>
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
          college: selectedUser.college || ''
        } as Partial<ProfilePreviewData> : undefined}
      />
    </div>
  );
};

export default Leaderboards;
