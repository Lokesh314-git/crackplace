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
  FaCircleQuestion,
  FaComments,
  FaBookOpen,
  FaBolt
} from 'react-icons/fa6';
import { Link } from 'react-router-dom';
import MissionsDeck from '../components/MissionsDeck';
import { Card, StatCard, Badge } from '../components/ui';
import { calculateLevelProgress } from '../utils/levelCalculator';
import { calculatePlacementReadiness } from '../utils/readiness';

export const Dashboard: React.FC = () => {
  const { userProfile } = useAuthStore();

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
      to: '/quiz',
      title: 'AI Placement Quiz',
      desc: 'Generate adaptive technical MCQs on target company patterns.',
      icon: <FaCircleQuestion className="w-4 h-4" />,
      tag: 'Adaptive AI',
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
            Welcome!, {userProfile.displayName || 'Candidate'}
          </h1>
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
