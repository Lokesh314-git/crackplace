import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import AIAssistant from '../AIAssistant';
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
  FaUsers
} from 'react-icons/fa6';
import { useAuthStore } from '../../store/authStore';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Modal, Button } from '../ui';

export const DashboardLayout: React.FC = () => {
  const { userProfile } = useAuthStore();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState<{ levelBefore?: number; levelAfter: number; earnedXp?: number } | null>(null);
  const [activeToast, setActiveToast] = useState<{ id: string; type: string; title: string; message: string } | null>(null);

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

      {/* Mobile Slide Drawer for secondary links */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="w-72 bg-white border-r border-slate-200 p-5 space-y-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900">More Resources</span>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <FaXmark className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                <NavLink
                  to="/study-notes"
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors
                    ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                  `}
                >
                  <FaBookOpen className="w-4 h-4 text-slate-400" />
                  <span>Study Notes & Revision</span>
                </NavLink>

                <NavLink
                  to="/store"
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors
                    ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                  `}
                >
                  <FaStore className="w-4 h-4 text-slate-400" />
                  <span>Armory Rewards Store</span>
                </NavLink>

                <NavLink
                  to="/invite-promote"
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors
                    ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                  `}
                >
                  <FaUsers className="w-4 h-4 text-slate-400" />
                  <span>Invite & Promote</span>
                </NavLink>

                <NavLink
                  to="/personalization"
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors
                    ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                  `}
                >
                  <FaGear className="w-4 h-4 text-slate-400" />
                  <span>Customization Settings</span>
                </NavLink>
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              CrackPlace AI • Modern Placement Suite
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

      {/* Floating AI Placement Assistant */}
      {!location.pathname.includes('/battle') && !location.pathname.includes('/practice') && (
        <AIAssistant />
      )}

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
