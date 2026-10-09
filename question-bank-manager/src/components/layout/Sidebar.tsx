import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  PlusCircle,
  FileUp,
  Layers,
  Settings,
  Server,
  Zap,
  TrendingUp,
  Users,
  Video,
  Gift,
  Banknote,
  Settings2,
  ClipboardList,
  UserCog
} from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/users', label: 'User Management', icon: UserCog },
    { to: '/questions', label: 'All Questions', icon: Database },
    { to: '/add-question', label: 'Add Question', icon: PlusCircle },
    { to: '/import-csv', label: 'Import CSV', icon: FileUp, badge: 'Batch' },
    { to: '/subjects', label: 'Subjects', icon: Layers },
    { to: '/settings', label: 'Settings & API', icon: Settings }
  ];

  const growthItems = [
    { to: '/growth/dashboard', label: 'Growth Dashboard', icon: TrendingUp },
    { to: '/growth/referrals', label: 'Referral Management', icon: Users },
    { to: '/growth/influencers', label: 'Influencer Submissions', icon: Video },
    { to: '/growth/rewards', label: 'Gift & Reward Management', icon: Gift },
    { to: '/growth/cash', label: 'Pending Cash Payments', icon: Banknote },
    { to: '/growth/settings', label: 'Campaign Settings', icon: Settings2 },
    { to: '/growth/audit', label: 'Growth Audit Logs', icon: ClipboardList }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white tracking-tight text-sm">
              <span>CrackPlace AI</span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Question Bank Manager
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}

          <div className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            GROWTH & REWARDS
          </div>
          {growthItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Database Status Card */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 p-3 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-500" />
                Data Source
              </span>
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {isSupabaseConfigured ? 'Supabase PostgreSQL' : 'Local Sandbox Mode'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isSupabaseConfigured
                ? 'Connected & RLS active'
                : 'Connect Supabase in Settings'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
