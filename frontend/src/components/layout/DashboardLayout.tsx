import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  FaHouse, 
  FaCode, 
  FaGamepad, 
  FaTrophy, 
  FaUser, 
  FaXmark,
  FaBookOpen,
  FaStore,
  FaGear,
  FaCrown,
  FaUsers,
  FaComments,
  FaLayerGroup,
  FaUserShield,
  FaRightFromBracket
} from 'react-icons/fa6';
import { useAuthStore } from '../../store/authStore';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Modal, Button } from '../ui';

export const DashboardLayout: React.FC = () => {
  const { userProfile, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState<{ levelBefore?: number; levelAfter: number; earnedXp?: number } | null>(null);
  const [activeToast, setActiveToast] = useState<{ id: string; type: string; title: string; message: string } | null>(null);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  useEffect(() => {
    const handleLevelUp = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setShowLevelUpModal({
        levelBefore: detail.levelBefore || Math.max(1, (detail.levelAfter || detail.level) - 1),
        levelAfter: detail.levelAfter || detail.level,
        earnedXp: detail.earnedXp
      });
    };

    window.addEventListener('level-up', handleLevelUp);
    return () => window.removeEventListener('level-up', handleLevelUp);
  }, []);

  useEffect(() => {
    if (!userProfile?.uid || !db) return;

    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userProfile.uid),
        where('read', '==', false)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const notifData = change.doc.data();
            const notifId = change.doc.id;
            
            setActiveToast({
              id: notifId,
              type: notifData.type,
              title: notifData.title,
              message: notifData.message
            });

            // Mark as read
            try {
              await updateDoc(doc(db, 'notifications', notifId), { read: true });
            } catch (err) {
              console.error('Failed to mark notification as read:', err);
            }
          }
        });
      });

      return () => unsubscribe();
    } catch (err) {
      // Safe fallback
    }
  }, [userProfile?.uid]);

  const bottomNavItems = [
    { to: '/dashboard', label: 'Home', icon: <FaHouse className="w-4 h-4" /> },
    { to: '/practice', label: 'Practice', icon: <FaCode className="w-4 h-4" /> },
    { to: '/battle', label: 'Battle', icon: <FaGamepad className="w-4 h-4" /> },
    { to: '/leaderboard', label: 'Rankings', icon: <FaTrophy className="w-4 h-4" /> },
    { to: '/profile', label: 'Profile', icon: <FaUser className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Desktop Left Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Container */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar onMenuClick={() => setIsDrawerOpen(true)} />

        {/* Content Shell with max-width containment */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 bottom-nav-padding md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Slide Drawer for navigation */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-80 max-w-[85vw] bg-white border-r border-slate-200 p-5 space-y-4 flex flex-col justify-between shadow-xl overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs">
                    C
                  </div>
                  <span className="font-bold text-sm text-slate-900">
                    CrackPlace <span className="text-blue-600">AI</span>
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Close menu"
                >
                  <FaXmark className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-4 text-xs">
                {/* Learning & Practice */}
                <div className="space-y-1">
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    LEARNING & PRACTICE
                  </span>
                  <NavLink
                    to="/dashboard"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaHouse className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Dashboard</span>
                  </NavLink>
                  <NavLink
                    to="/practice"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaLayerGroup className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Practice Hub</span>
                  </NavLink>
                  <NavLink
                    to="/coding"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaCode className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Coding Workspace</span>
                  </NavLink>
                  <NavLink
                    to="/hr-interview"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaComments className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>HR Practice</span>
                  </NavLink>
                </div>

                {/* Compete & Rewards */}
                <div className="space-y-1">
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    COMPETE & REWARDS
                  </span>
                  <NavLink
                    to="/battle"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaGamepad className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Battle Arena</span>
                  </NavLink>
                  <NavLink
                    to="/leaderboard"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaTrophy className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Leaderboards</span>
                  </NavLink>
                  <NavLink
                    to="/store"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaStore className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Armory Rewards Store</span>
                  </NavLink>
                  <NavLink
                    to="/invite-promote"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaUsers className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Invite & Promote</span>
                  </NavLink>
                </div>

                {/* Resources & Account */}
                <div className="space-y-1">
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    RESOURCES & ACCOUNT
                  </span>
                  <NavLink
                    to="/study-notes"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaBookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Study Notes & Revision</span>
                  </NavLink>
                  <NavLink
                    to="/profile"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaUser className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>My Profile</span>
                  </NavLink>
                  <NavLink
                    to="/personalization"
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                      ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                    `}
                  >
                    <FaGear className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Customization Settings</span>
                  </NavLink>
                </div>

                {/* Administration */}
                {userProfile?.role === 'admin' && (
                  <div className="space-y-1 pt-2 border-t border-slate-100">
                    <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      ADMINISTRATION
                    </span>
                    <NavLink
                      to="/admin"
                      onClick={() => setIsDrawerOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-colors
                        ${isActive ? 'bg-purple-50 text-purple-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                      `}
                    >
                      <FaUserShield className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Admin Panel</span>
                    </NavLink>
                  </div>
                )}
              </nav>
            </div>

            {/* Drawer Footer with User Card & Logout */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              {userProfile && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {userProfile.displayName || 'Candidate'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Level {userProfile.level || 1} • {userProfile.coins || 0} Coins
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsDrawerOpen(false);
                      handleLogout();
                    }}
                    title="Sign Out"
                    className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <FaRightFromBracket className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="text-[10px] text-slate-400 text-center">
                CrackPlace AI • Placement Suite
              </div>
            </div>
          </div>

          <div className="flex-1" onClick={() => setIsDrawerOpen(false)} />
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-sm">
        <div className="grid grid-cols-5 h-14">
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `
                flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors select-none
                ${isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'}
              `}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Level Up Notification Modal */}
      <Modal
        isOpen={!!showLevelUpModal}
        onClose={() => setShowLevelUpModal(null)}
        title="Level Up!"
        footer={
          <Button variant="primary" size="sm" onClick={() => setShowLevelUpModal(null)}>
            Continue Preparation
          </Button>
        }
      >
        <div className="text-center py-5 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-sm animate-bounce">
            <FaCrown className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xl font-bold text-slate-900 tracking-tight">Level Up!</h4>
            <div className="flex items-center justify-center gap-2 text-base font-semibold text-blue-600 mt-2">
              <span>Level {showLevelUpModal?.levelBefore}</span>
              <span>→</span>
              <span className="text-lg font-bold text-blue-700">Level {showLevelUpModal?.levelAfter}</span>
            </div>
            {showLevelUpModal?.earnedXp !== undefined && showLevelUpModal.earnedXp > 0 && (
              <p className="text-xs font-mono font-bold text-purple-600 pt-1">
                +{showLevelUpModal.earnedXp} XP
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            You unlocked higher placement ranking criteria and milestone rewards. Keep practicing!
          </p>
        </div>
      </Modal>

      {/* Clean Notification Toast */}
      {activeToast && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-50 max-w-sm w-full bg-white border border-slate-200 p-4 rounded-xl shadow-lg animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="text-xs font-semibold text-slate-900">{activeToast.title}</h5>
              <p className="text-xs text-slate-600 mt-0.5">{activeToast.message}</p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <FaXmark className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
