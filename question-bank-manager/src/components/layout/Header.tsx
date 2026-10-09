import React from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  Plus,
  FileUp,
  LogOut,
  ShieldCheck,
  Database
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onOpenSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSidebar }) => {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 sm:px-6">
      {/* Left section: Mobile menu & title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span>PostgreSQL Single Source of Truth</span>
          </div>
        </div>
      </div>

      {/* Right section: Quick actions & user menu */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          to="/import-csv"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import CSV</span>
        </Link>

        <Link
          to="/add-question"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs shadow-indigo-600/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Question</span>
        </Link>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* User profile / Logout */}
        <div className="flex items-center gap-2 pl-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {user?.email || 'Admin'}
              </p>
              <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                Authorized Admin
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            title="Sign Out"
            className="rounded-lg p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
