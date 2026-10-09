import React from 'react';
import { useAuthStore } from '../../store/authStore';
import { FaFire, FaCoins, FaCrown, FaBars, FaBolt } from 'react-icons/fa6';
import { Link, useLocation } from 'react-router-dom';
import { calculateLevelProgress } from '../../utils/levelCalculator';
import { calculatePlacementReadiness } from '../../utils/readiness';

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { userProfile } = useAuthStore();
  const location = useLocation();

  if (!userProfile) return null;

  const readiness = calculatePlacementReadiness(userProfile);
  const rawXp = Number(userProfile.xp ?? userProfile.totalXp ?? 0);
  const levelProg = calculateLevelProgress(rawXp);

  const getPageTitle = (path: string) => {
    if (path.includes('/dashboard')) return { title: 'Dashboard', desc: 'Placement preparation overview & progress' };
    if (path.includes('/practice')) return { title: 'Practice Hub', desc: 'Curated topics & problem categories' };
    if (path.includes('/quiz')) return { title: 'AI Placement Quiz', desc: 'Adaptive technical assessment questions' };
    if (path.includes('/coding')) return { title: 'Coding Workspace', desc: 'Interactive algorithmic problem solving' };
    if (path.includes('/hr-interview')) return { title: 'HR Practice', desc: 'Behavioral & behavioral mock interview' };
    if (path.includes('/battle')) return { title: 'Battle Arena', desc: 'Real-time 1v1 multiplayer placement battle' };
    if (path.includes('/leaderboard')) return { title: 'Leaderboards', desc: 'Global & cohort competitive rankings' };
    if (path.includes('/store')) return { title: 'Armory Store', desc: 'Cosmetic rewards & unlocks' };
    if (path.includes('/study-notes')) return { title: 'Study Notes', desc: 'Placement revision cheatsheets & notes' };
    if (path.includes('/profile')) return { title: 'Student Profile', desc: 'Academic details, stats & achievements' };
    return { title: 'Placement Center', desc: 'Skill preparation & assessments' };
  };

  const pageInfo = getPageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-8 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      {/* Mobile Menu Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 md:hidden transition-colors cursor-pointer"
          aria-label="Toggle Menu"
        >
          <FaBars className="w-4 h-4" />
        </button>
        <div>
          <h2 className="font-bold text-sm md:text-base text-slate-900 leading-tight">
            {pageInfo.title}
          </h2>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {pageInfo.desc}
          </p>
        </div>
      </div>

      {/* Clean Header Badges & User Progression Stats */}
      <div className="flex flex-wrap justify-end items-center gap-1.5 md:gap-3">
        {/* Authoritative Level & XP Progress Capsule */}
        <Link
          to="/profile"
          title={`Level ${levelProg.level} (${levelProg.xpProgressInLevel}/${levelProg.xpNeededForNextLevel} XP to Level ${levelProg.level + 1}, Total: ${levelProg.totalXp} XP)`}
          className="hidden sm:flex items-center gap-1.5 md:gap-2 px-1.5 py-1 md:px-2.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] md:text-xs font-semibold hover:bg-purple-100 transition-colors shadow-xs shrink-0"
        >
          <FaBolt className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-600" />
          <span>Lvl {levelProg.level}</span>
          <span className="text-[10px] text-purple-500 font-mono hidden md:inline">({levelProg.xpProgressInLevel}/{levelProg.xpNeededForNextLevel} XP)</span>
        </Link>

        {/* Streak counter */}
        <div
          title={`${userProfile.dailyStreak} Day Streak`}
          className="flex items-center gap-1 md:gap-1.5 px-1.5 py-1 md:px-2.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] md:text-xs font-semibold shadow-xs shrink-0"
        >
          <FaFire className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-500" />
          <span>{userProfile.dailyStreak || 0}d</span>
        </div>

        {/* Coins count */}
        <Link
          to="/store"
          title="Coins Balance (Open Store)"
          className="flex items-center gap-1 md:gap-1.5 px-1.5 py-1 md:px-2.5 rounded-md bg-slate-50 text-slate-700 hover:text-amber-700 border border-slate-200 text-[10px] md:text-xs font-semibold transition-colors shadow-xs shrink-0"
        >
          <FaCoins className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-500" />
          <span>{userProfile.coins || 0}</span>
        </Link>

        {/* Battle Rating */}
        <div
          title="Battle Elo Rating"
          className="flex items-center gap-1 md:gap-1.5 px-1.5 py-1 md:px-2.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] md:text-xs font-semibold shadow-xs shrink-0"
        >
          <FaCrown className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600" />
          <span>{userProfile.battleRating || 1000}</span>
        </div>

        {/* Readiness Capsule */}
        <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block leading-none">
              Readiness
            </span>
            <span className="text-xs font-bold text-emerald-600">
              {readiness.displayText}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
