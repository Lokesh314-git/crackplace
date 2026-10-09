import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { calculateLevelFromXP } from '../../utils/levelCalculator';
import { getUserAvatarUrl } from '../../utils/avatarResolver';
import { 
  FaHouse, 
  FaLayerGroup, 
  FaCode, 
  FaComments, 
  FaGamepad, 
  FaBookOpen, 
  FaUserShield,
  FaRightFromBracket,
  FaStore,
  FaTrophy,
  FaUser,
  FaGear,
  FaBullhorn
} from 'react-icons/fa6';

export const Sidebar: React.FC = () => {
  const { userProfile, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const navSections = [
    {
      title: 'LEARNING & PRACTICE',
      items: [
        { to: '/dashboard', label: 'Dashboard', icon: <FaHouse className="w-4 h-4" /> },
        { to: '/practice', label: 'Practice Hub', icon: <FaLayerGroup className="w-4 h-4" /> },
        { to: '/coding', label: 'Coding Workspace', icon: <FaCode className="w-4 h-4" /> },
        { to: '/hr-interview', label: 'HR Practice', icon: <FaComments className="w-4 h-4" /> },
      ]
    },
    {
      title: 'COMPETE & REWARDS',
      items: [
        { to: '/battle', label: 'Battle Arena', icon: <FaGamepad className="w-4 h-4" /> },
        { to: '/leaderboard', label: 'Leaderboard', icon: <FaTrophy className="w-4 h-4" /> },
        { to: '/store', label: 'Armory Store', icon: <FaStore className="w-4 h-4" /> },
        { to: '/invite-promote', label: 'Invite & Promote', icon: <FaBullhorn className="w-4 h-4" /> },
      ]
    },
    {
      title: 'RESOURCES & ACCOUNT',
      items: [
        { to: '/study-notes', label: 'Study Notes', icon: <FaBookOpen className="w-4 h-4" /> },
        { to: '/profile', label: 'My Profile', icon: <FaUser className="w-4 h-4" /> },
        { to: '/personalization', label: 'Customization', icon: <FaGear className="w-4 h-4" /> },
      ]
    }
  ];

  const isAdmin = userProfile?.role === 'admin';

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex flex-col w-64 border-r border-slate-200 bg-white">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-100">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-base shadow-xs">
          C
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-slate-900 tracking-tight leading-tight">
            CrackPlace <span className="text-blue-600 font-semibold">AI</span>
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            Placement Prep Platform
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-0.5">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {section.title}
            </span>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }
                `}
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}

        {/* Admin Navigation */}
        {isAdmin && (
          <div className="space-y-0.5 pt-2 border-t border-slate-100">
            <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              ADMINISTRATION
            </span>
            <NavLink
              to="/admin"
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors
                ${isActive 
                  ? 'bg-purple-50 text-purple-700 font-semibold' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }
              `}
            >
              <FaUserShield className="w-4 h-4 shrink-0" />
              <span>Admin Panel</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* User Footer Profile */}
      {userProfile && (
        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
            <img
              src={getUserAvatarUrl(userProfile)}
              alt={userProfile.displayName}
              className="w-8 h-8 rounded-full bg-slate-100 object-cover border border-slate-200"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {userProfile.displayName || 'Candidate'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Level {calculateLevelFromXP(userProfile.xp ?? userProfile.totalXp ?? 0)} • {userProfile.role || 'Student'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <FaRightFromBracket className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
