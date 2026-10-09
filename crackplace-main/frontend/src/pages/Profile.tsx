import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate, Link } from 'react-router-dom';
import { calculateLevelProgress } from '../utils/levelCalculator';
import { getUserAvatarUrl } from '../utils/avatarResolver';
import { calculatePlacementReadiness } from '../utils/readiness';
import { 
  FaCrown, 
  FaFire, 
  FaCoins, 
  FaTrophy, 
  FaGraduationCap, 
  FaBriefcase, 
  FaRightFromBracket,
  FaAward,
  FaUserGear,
  FaBolt
} from 'react-icons/fa6';

export const Profile: React.FC = () => {
  const { userProfile, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const readiness = calculatePlacementReadiness(userProfile);
  const [activeTab, setActiveTab] = React.useState<'achievements' | 'history' | 'xp_history'>('achievements');
  const [history, setHistory] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const [xpTransactions, setXpTransactions] = React.useState<any[]>([]);
  const [loadingXpTx, setLoadingXpTx] = React.useState(false);

  React.useEffect(() => {
    if (activeTab === 'history' && token) {
      setLoadingHistory(true);
      fetch('/api/auth/battle/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setHistory(data.history || []);
          setLoadingHistory(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingHistory(false);
        });
    } else if (activeTab === 'xp_history' && token) {
      setLoadingXpTx(true);
      fetch('/api/auth/xp/transactions', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setXpTransactions(data.transactions || []);
          setLoadingXpTx(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingXpTx(false);
        });
    }
  }, [activeTab, token]);

  if (!userProfile) return null;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const rawXp = Number(userProfile.xp ?? userProfile.totalXp ?? 0);
  const lvlDetails = calculateLevelProgress(rawXp);

  const ACHIEVEMENTS = [
    { id: 'first_quiz', title: 'First Assessment', desc: 'Complete your first subject placement quiz.', icon: '📝' },
    { id: 'solve_100', title: 'Century Milestone', desc: 'Solve 100 questions total across subject quizzes.', icon: '💯' },
    { id: 'solve_500', title: 'Placement Scholar', desc: 'Solve 500 questions across training modules.', icon: '🎓' },
    { id: 'streak_7', title: '7-Day Habit', desc: 'Maintain a preparation active streak of 7 days.', icon: '🔥' },
    { id: 'streak_30', title: 'Consistent Candidate', desc: 'Maintain a preparation active streak of 30 days.', icon: '⚡' },
    { id: 'coding_master', title: 'Coding Specialist', desc: 'Successfully solve and submit 5 algorithmic challenges.', icon: '💻' },
    { id: 'hr_expert', title: 'STAR Communicator', desc: 'Complete 3 mock interviews with AI feedback.', icon: '💼' },
    { id: 'battle_champion', title: 'Competitive Ace', desc: 'Secure 5 peer battle assessment victories.', icon: '⚔️' },
    { id: 'placement_ready', title: 'Placement Ready', desc: 'Reach a Placement Readiness quotient of 80% or higher.', icon: '🚀' }
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 animate-fade-in">
      {/* Profile Header Card */}
      <div className="bg-surface-dark border border-border-dark p-6 sm:p-7 rounded-2xl relative shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="w-20 h-20 rounded-2xl bg-surface-elevated border border-border-dark overflow-hidden flex items-center justify-center font-bold text-xl text-text-primary shrink-0">
          <img
            src={getUserAvatarUrl(userProfile)}
            alt={userProfile.displayName}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-bold text-text-primary truncate">{userProfile.displayName}</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-600/10 text-brand-400 border border-brand-500/20">
                  Level {lvlDetails.level}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{userProfile.email || 'Placement Candidate'}</p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-1 sm:pt-0">
              <button
                onClick={() => navigate('/personalization?tab=edit_profile')}
                className="px-3.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-slate-700 border border-border-dark text-xs font-semibold text-text-primary transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <FaUserGear className="w-3.5 h-3.5 text-text-muted" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>

          {/* Level Progress Bar */}
          <div className="pt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-text-muted font-medium">Level {lvlDetails.level} Experience</span>
              <span className="text-text-secondary font-mono font-semibold">{lvlDetails.xpProgressInLevel} / {lvlDetails.xpNeededForNextLevel} XP ({lvlDetails.progressPercentage}%)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${lvlDetails.progressPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-text-muted pt-0.5">
              <span>Current Level Base: {lvlDetails.currentLevelBaseXp} XP</span>
              <span className="font-semibold text-brand-400">Total XP: {lvlDetails.totalXp}</span>
              <span>Next Level: {lvlDetails.nextLevelRequiredXp} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Stat Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-surface-dark border border-border-dark p-4 rounded-xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <FaFire className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase">Streak</p>
            <p className="font-bold text-base text-text-primary mt-0.5 truncate">{userProfile.dailyStreak} Days</p>
          </div>
        </div>

        <div className="bg-surface-dark border border-border-dark p-4 rounded-xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-lg bg-brand-600/10 text-brand-400 shrink-0">
            <FaCrown className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase">Rating</p>
            <p className="font-bold text-base text-brand-400 mt-0.5 truncate">{userProfile.battleRating} Elo</p>
          </div>
        </div>

        <Link to="/store" className="bg-surface-dark border border-border-dark p-4 rounded-xl flex items-center gap-3 hover:bg-surface-elevated/40 transition-colors shadow-xs">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <FaCoins className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase">Coins</p>
            <p className="font-bold text-base text-amber-400 mt-0.5 truncate">{userProfile.coins}</p>
          </div>
        </Link>

        <div className="bg-surface-dark border border-border-dark p-4 rounded-xl flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <FaTrophy className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-text-muted uppercase">Readiness</p>
            <p className="font-bold text-base text-emerald-400 mt-0.5 truncate">{readiness.displayText}</p>
          </div>
        </div>
      </div>

      {/* Academic Information Card */}
      <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl space-y-3 shadow-xs">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-text-muted border-b border-border-dark pb-2">
          Academic Profile & Career Goals
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-surface-elevated text-brand-400 mt-0.5 shrink-0">
              <FaGraduationCap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{userProfile.college || 'Engineering Institute'}</p>
              <p className="text-text-muted text-[11px] mt-0.5">{userProfile.department || 'Computer Science'}, Year {userProfile.year || '3'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-surface-elevated text-purple-400 mt-0.5 shrink-0">
              <FaBriefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">Target Organization</p>
              <p className="text-purple-400 text-[11px] font-semibold uppercase mt-0.5">{userProfile.dreamCompany || 'Tier-1 Tech Companies'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-surface-dark border border-border-dark p-1 rounded-xl w-full shadow-xs gap-1">
        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex-1 py-2.5 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'achievements' 
              ? 'bg-brand-600 text-white shadow-xs' 
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Unlocked Achievements
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'history' 
              ? 'bg-brand-600 text-white shadow-xs' 
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          Assessment History
        </button>
        <button
          onClick={() => setActiveTab('xp_history')}
          className={`flex-1 py-2.5 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'xp_history' 
              ? 'bg-brand-600 text-white shadow-xs' 
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <FaBolt className="w-3 h-3 text-purple-400" />
          <span>XP Audit Log</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'achievements' && (
        <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border-dark pb-2">
            <FaAward className="w-4 h-4 text-brand-400" />
            <h3 className="font-semibold text-xs uppercase tracking-wider text-text-muted">
              Curated Milestones ({userProfile.unlockedAchievements?.length || 0} / {ACHIEVEMENTS.length})
            </h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACHIEVEMENTS.map((ach) => {
              const isUnlocked = userProfile.unlockedAchievements?.includes(ach.id);
              return (
                <div
                  key={ach.id}
                  className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                    isUnlocked
                      ? 'border-brand-500/30 bg-brand-500/5 text-text-primary'
                      : 'border-border-dark bg-surface-elevated/30 opacity-50'
                  }`}
                >
                  <div className="text-xl p-2 rounded-lg bg-surface-dark border border-border-dark shrink-0">
                    {ach.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-semibold text-xs text-text-primary truncate">{ach.title}</h4>
                      {!isUnlocked && <span className="text-[10px] text-text-muted">🔒</span>}
                    </div>
                    <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{ach.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-border-dark pb-2">
            <FaTrophy className="w-4 h-4 text-brand-400" />
            <h3 className="font-semibold text-xs uppercase tracking-wider text-text-muted">
              Recent 1v1 Battle Sessions
            </h3>
          </div>

          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto"></div>
              <p className="text-xs text-text-muted mt-2">Loading match history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 space-y-1">
              <p className="text-xs text-text-secondary font-medium">No battle records yet.</p>
              <p className="text-[11px] text-text-muted">Complete your first 1v1 match in the Battle Arena to see results here.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item) => {
                const myUid = userProfile.uid;
                const oppUid = item.uids?.find((uid: string) => uid !== myUid) 
                  || Object.keys(item.players || {}).find(uid => uid !== myUid) 
                  || Object.keys(item.scores || {}).find(uid => uid !== myUid);

                const me = item.players?.[myUid];
                const opp = oppUid ? item.players?.[oppUid] : null;

                const myScore = me?.score ?? item.scores?.[myUid] ?? 0;
                const oppScore = opp?.score ?? (oppUid ? item.scores?.[oppUid] : 0) ?? 0;

                const isDraw = item.isDraw || item.winnerId === 'draw';
                const isWinner = item.winnerId === myUid;

                let outcomeText = 'Draw';
                let outcomeColor = 'bg-slate-500/10 text-slate-300 border-slate-500/20';
                if (!isDraw) {
                  outcomeText = isWinner ? 'Won' : 'Lost';
                  outcomeColor = isWinner 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                }

                const myEloChange = me?.eloChange ?? item.eloChanges?.[myUid] ?? (isDraw ? 0 : (isWinner ? 25 : -20));

                return (
                  <div key={item.id} className="p-3.5 rounded-xl border border-border-dark bg-surface-elevated/30 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-surface-dark border border-border-dark overflow-hidden flex items-center justify-center font-bold text-[10px] shrink-0">
                        <img src={getUserAvatarUrl(opp)} alt={opp?.displayName || 'Opponent'} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-brand-400 uppercase">{item.category}</span>
                        <h4 className="font-semibold text-text-primary truncate">vs {opp?.displayName || 'Peer Candidate'}</h4>
                        <p className="text-[10px] text-text-muted">{new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-text-muted block">Score</span>
                        <span className="font-bold text-text-primary font-mono">{myScore} - {oppScore}</span>
                      </div>
                      
                      <div className="text-right hidden sm:block">
                        <span className="text-[10px] text-text-muted block">Elo Change</span>
                        <span className={`font-bold font-mono ${myEloChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {myEloChange >= 0 ? `+${myEloChange}` : myEloChange}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${outcomeColor}`}>
                        {outcomeText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'xp_history' && (
        <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border-dark pb-2">
            <div className="flex items-center gap-2">
              <FaBolt className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-xs uppercase tracking-wider text-text-muted">
                Authoritative XP Audit History
              </h3>
            </div>
            <span className="text-[10px] font-mono text-text-muted">Server Authoritative Log</span>
          </div>

          {loadingXpTx ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mx-auto"></div>
              <p className="text-xs text-text-muted mt-2">Loading immutable transaction records...</p>
            </div>
          ) : xpTransactions.length === 0 ? (
            <div className="text-center py-8 space-y-1">
              <p className="text-xs text-text-secondary font-medium">No XP transactions logged yet.</p>
              <p className="text-[11px] text-text-muted">Complete assessments, arena battles, or daily routines to earn XP!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {xpTransactions.map((tx, idx) => {
                const sourceLabels: Record<string, string> = {
                  battle: '1v1 Battle Arena',
                  quiz: 'Subject Placement Quiz',
                  coding: 'Algorithmic Challenge',
                  interview: 'Mock HR Interview',
                  study_notes: 'Study Cheatsheet Test',
                  mission: 'Gamified Mission Goal',
                  daily_login: 'Daily Routine Login',
                  lucky_spin: 'Armory Lucky Spin',
                  mystery_box: 'Mystery Loot Box',
                  achievement: 'Milestone Achievement'
                };

                const label = sourceLabels[tx.source] || tx.source.toUpperCase();

                return (
                  <div key={tx.id || idx} className="p-3.5 rounded-xl border border-border-dark bg-surface-elevated/30 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary text-xs">{label}</span>
                        {tx.leveledUp && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            ★ Level Up! (Lvl {tx.levelBefore} → {tx.levelAfter})
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                        {new Date(tx.createdAt).toLocaleString()} • Ref: {tx.referenceId}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <span className="text-[10px] text-text-muted block">XP Delta</span>
                        <span className="font-bold text-purple-400 font-mono text-sm">+{tx.xpEarned} XP</span>
                      </div>
                      <div className="hidden sm:block">
                        <span className="text-[10px] text-text-muted block">Balance</span>
                        <span className="font-mono text-[11px] text-text-secondary">{tx.xpBefore} → {tx.xpAfter}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted block">Level</span>
                        <span className="font-bold text-text-primary text-xs">Lvl {tx.levelAfter}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sign Out Action */}
      <button
        onClick={handleLogout}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border-dark hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 text-text-secondary text-xs font-semibold transition-colors cursor-pointer"
      >
        <FaRightFromBracket className="w-3.5 h-3.5" />
        <span>Sign Out of Account</span>
      </button>
    </div>
  );
};

export default Profile;
