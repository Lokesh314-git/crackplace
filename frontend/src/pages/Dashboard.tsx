import React from 'react';
import { useAuthStore } from '../store/authStore';
import { 
  FaGraduationCap, 
  FaBriefcase, 
  FaGamepad, 
  FaCode, 
  FaFire, 
  FaCoins, 
  FaCrown,
  FaArrowRight,
  FaComments,
  FaBookOpen,
  FaBolt,
  FaGift,
  FaXmark
} from 'react-icons/fa6';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import MissionsDeck from '../components/MissionsDeck';
import { Card, StatCard, Badge } from '../components/ui';
import { calculateLevelProgress } from '../utils/levelCalculator';
import { calculatePlacementReadiness } from '../utils/readiness';

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuthStore();
  const [showPromoBanner, setShowPromoBanner] = useState(() => sessionStorage.getItem('hidePromoBanner') !== 'true');

  if (!userProfile) return null;
  const readiness = calculatePlacementReadiness(userProfile);

  const coreModules = [
    {
      to: '/practice',
      title: 'Practice Hub',
      desc: 'Topic-wise practice across Aptitude, DSA, DBMS & OS.',
      icon: <FaCode className="w-4 h-4" />,
      tag: 'Core Topics',
    },
    {
      to: '/coding',
      title: 'Coding Workspace',
      desc: 'Solve algorithmic challenges with instant compiler feedback.',
      icon: <FaBolt className="w-4 h-4" />,
      tag: 'Algorithms',
    },
    {
      to: '/hr-interview',
      title: 'HR Interview Practice',
      desc: 'Simulate behavioral and HR rounds with AI evaluation.',
      icon: <FaComments className="w-4 h-4" />,
      tag: 'Interviews',
    },
    {
      to: '/battle',
      title: 'Battle Arena',
      desc: 'Compete in 1v1 live timed battles to raise your Elo rating.',
      icon: <FaGamepad className="w-4 h-4" />,
      tag: '1v1 Live',
    },
    {
      to: '/study-notes',
      title: 'Study Notes',
      desc: 'Placement preparation cheatsheets, algorithms & interview notes.',
      icon: <FaBookOpen className="w-4 h-4" />,
      tag: 'Revision',
    },
  ];

  const rawXp = Number(userProfile.xp ?? userProfile.totalXp ?? 0);
  const levelProg = calculateLevelProgress(rawXp);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              Placement Preparation
            </Badge>
            <span className="text-xs text-slate-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back, {userProfile.displayName || 'Candidate'}
          </h1>
          <p className="text-xs md:text-sm text-slate-600 max-w-xl">
            Continue your daily preparation path to target <strong className="text-slate-900 font-semibold">{userProfile.dreamCompany || 'Tier-1 Tech Companies'}</strong>.
          </p>
        </div>

        {/* Readiness Quotient Widget */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 w-full md:w-auto shrink-0">
          <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex flex-col items-center justify-center">
            <span className="text-xs font-bold text-blue-700 text-center px-1">
              {readiness.displayText}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900">Readiness Score</p>
            <p className="text-[11px] text-slate-500">Benchmark target: 85%+</p>
          </div>
        </div>
      </div>

      {/* Invite & Promote Promotional Banner */}
      {showPromoBanner && (
        <div className="relative group">
          <Link 
            to="/invite-promote" 
            className="block overflow-hidden bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-xl p-4 md:p-5 transition-all duration-200 hover:shadow-sm"
          >
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-50 dark:border-indigo-900/30">
                  <FaGift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                    Grow your CrackPlace circle
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Invite friends, earn rewards, and climb together.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 md:mt-0 ml-16 md:ml-0">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors shadow-xs">
                  Explore Invite & Promote
                  <FaArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              sessionStorage.setItem('hidePromoBanner', 'true');
              setShowPromoBanner(false);
            }}
            className="absolute top-2 right-2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 rounded-full transition-colors z-10"
            aria-label="Dismiss banner"
          >
            <FaXmark className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Progression Level"
          value={`Level ${levelProg.level}`}
          subtext={`${levelProg.xpProgressInLevel} / ${levelProg.xpNeededForNextLevel} XP (${levelProg.progressPercentage}%)`}
          accentColor="purple"
        />
        <StatCard
          label="Battle Rating"
          value={userProfile.battleRating || 1000}
          subtext="Placement Competitive Elo"
          accentColor="blue"
          icon={<FaCrown className="w-4 h-4" />}
        />
        <StatCard
          label="Daily Streak"
          value={`${userProfile.dailyStreak || 0} Days`}
          subtext="Consecutive practice streak"
          accentColor="amber"
          icon={<FaFire className="w-4 h-4" />}
        />
        <StatCard
          label="Earned Coins"
          value={userProfile.coins || 0}
          subtext="Rewards store balance"
          accentColor="emerald"
          icon={<FaCoins className="w-4 h-4" />}
        />
      </div>

      {/* Academic Track & Goal Summary */}
      <Card
        header={
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Academic Track & Objective
            </h3>
            <Link to="/profile" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Edit Profile →
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
            <div className="p-2 rounded-md bg-blue-50 text-blue-600">
              <FaGraduationCap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-500 text-[11px]">Enrolled Institution</p>
              <p className="font-semibold text-slate-900">
                {userProfile.college || 'College not specified'} ({userProfile.department || 'CS/IT'}, Year {userProfile.year || 1})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200/80">
            <div className="p-2 rounded-md bg-purple-50 text-purple-600">
              <FaBriefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="text-slate-500 text-[11px]">Target Placement Goal</p>
              <p className="font-semibold text-slate-900">
                {userProfile.dreamCompany || 'Product Based Software Engineer'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Learning & Preparation Modules Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Placement Modules
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coreModules.map((item, idx) => (
            <Link
              key={idx}
              to={item.to}
              className="group block bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {item.icon}
                </div>
                <Badge variant="neutral" size="sm">
                  {item.tag}
                </Badge>
              </div>
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {item.title}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {item.desc}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform">
                <span>Start Practice</span>
                <FaArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Active Targets & Missions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active Targets & Missions
          </h3>
        </div>
        <MissionsDeck />
      </div>
    </div>
  );
};

export default Dashboard;
