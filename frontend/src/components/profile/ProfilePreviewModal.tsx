import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaXmark, FaBuilding, FaGraduationCap, FaFire, FaTrophy, FaStar, FaCrown } from 'react-icons/fa6';
import { useAuthStore } from '../../store/authStore';
import { getUserAvatarUrl, getAvatarImageUrl, SYSTEM_DEFAULT_AVATAR_VISUAL } from '../../utils/avatarResolver';
import { calculateLevelFromXP } from '../../utils/levelCalculator';

export interface ProfilePreviewData {
  uid: string;
  displayName: string;
  photoURL?: string;
  equippedAvatar?: string | null;
  level: number;
  xp: number;
  battleRating: number;
  dailyStreak: number;
  placementReadinessScore: number;
  dreamCompany: string;
  college: string;
  coins: number;
  rank?: number; // Passed from leaderboard
  isLegendaryPlayer?: boolean;
}

interface ProfilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string | null;
  initialData?: Partial<ProfilePreviewData>;
}

export const ProfilePreviewModal: React.FC<ProfilePreviewModalProps> = ({
  isOpen,
  onClose,
  uid,
  initialData
}) => {
  const { token } = useAuthStore();
  const [profile, setProfile] = useState<ProfilePreviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && uid) {
      if (initialData) {
        setProfile(initialData as ProfilePreviewData);
      }
      fetchProfile(uid);
    } else {
      setProfile(null);
      setError(null);
    }
  }, [isOpen, uid]);

  const fetchProfile = async (targetUid: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/profile/${targetUid}/public`, { headers });
      if (!res.ok) {
        throw new Error('Failed to load profile');
      }
      const data = await res.json();
      setProfile(prev => ({ ...prev, ...data }));
    } catch (err: any) {
      console.error('Error fetching public profile:', err);
      if (!profile) setError('Unable to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const getReadinessStatus = (score: number) => {
    if (score >= 90) return { text: 'Placement Ready', color: 'text-brand-400', bar: 'bg-brand-500' };
    if (score >= 75) return { text: 'Strong', color: 'text-emerald-400', bar: 'bg-emerald-500' };
    if (score >= 60) return { text: 'Improving', color: 'text-blue-400', bar: 'bg-blue-500' };
    if (score >= 40) return { text: 'Developing', color: 'text-amber-400', bar: 'bg-amber-500' };
    return { text: 'Getting Started', color: 'text-slate-400', bar: 'bg-slate-500' };
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    const fallback = getAvatarImageUrl(SYSTEM_DEFAULT_AVATAR_VISUAL);
    if (target.src !== fallback) target.src = fallback;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-0"
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-surface-dark border border-border-dark rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white z-10 transition-colors backdrop-blur-md"
              >
                <FaXmark />
              </button>

              {error ? (
                <div className="p-8 text-center text-red-400">
                  <p>{error}</p>
                </div>
              ) : profile ? (
                <>
                  {/* Header / Avatar Banner */}
                  <div className={`relative pt-12 pb-6 px-6 flex flex-col items-center border-b ${
                    profile.isLegendaryPlayer 
                      ? 'bg-linear-to-b from-yellow-900/40 to-surface-dark border-yellow-500/30' 
                      : 'bg-linear-to-b from-brand-900/40 to-surface-dark border-border-dark'
                  }`}>
                    {profile.isLegendaryPlayer && (
                      <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-1 rounded border border-yellow-500/30 shadow-xs">
                        <FaCrown className="w-3 h-3" /> LEGENDARY PLAYER
                      </div>
                    )}
                    <div className={`w-24 h-24 rounded-full overflow-hidden shadow-xl bg-surface-elevated flex items-center justify-center relative z-10 ${
                      profile.isLegendaryPlayer ? 'border-4 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'border-4 border-surface-dark'
                    }`}>
                      <img
                        src={getUserAvatarUrl(profile)}
                        alt={profile.displayName || 'Cadet'}
                        onError={handleAvatarError}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    
                    <h2 className="mt-4 text-xl font-bold text-center truncate w-full flex items-center justify-center gap-2">
                      <span className={profile.isLegendaryPlayer ? 'text-yellow-400' : 'text-text-primary'}>
                        {profile.displayName || 'Cadet'}
                      </span>
                    </h2>
                    
                    {profile.college ? (
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-text-muted justify-center w-full">
                        <FaGraduationCap className="shrink-0" />
                        <span className="truncate">{profile.college}</span>
                      </div>
                    ) : (
                      <div className="h-5"></div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-6 space-y-6 overflow-y-auto">
                    
                    {/* Key Stats Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-elevated/40 border border-border-dark p-3 rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">Level</span>
                        <div className="text-lg font-bold text-text-primary font-mono">{calculateLevelFromXP(profile.xp || 0)}</div>
                      </div>
                      <div className="bg-surface-elevated/40 border border-border-dark p-3 rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1 flex items-center gap-1">
                          Streak
                        </span>
                        <div className="text-lg font-bold text-orange-400 font-mono flex items-center gap-1">
                          <FaFire className="w-4 h-4" /> {profile.dailyStreak || 0}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-elevated/40 border border-border-dark p-3 rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1 flex items-center gap-1">
                          Rating
                        </span>
                        <div className="text-lg font-bold text-brand-400 font-mono flex items-center gap-1">
                          <FaStar className="w-4 h-4" /> {profile.battleRating || 1200}
                        </div>
                      </div>
                      <div className="bg-surface-elevated/40 border border-border-dark p-3 rounded-2xl flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1 flex items-center gap-1">
                          Global Rank
                        </span>
                        <div className="text-lg font-bold text-amber-400 font-mono flex items-center gap-1">
                          <FaTrophy className="w-4 h-4" /> #{profile.rank || '--'}
                        </div>
                      </div>
                    </div>

                    {/* Placement Readiness */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Placement Readiness</span>
                        <span className="text-sm font-bold font-mono text-text-primary">{profile.placementReadinessScore || 0}%</span>
                      </div>
                      <div className="w-full bg-surface-elevated h-2.5 rounded-full overflow-hidden border border-border-dark">
                        <div
                          className={`h-full ${getReadinessStatus(profile.placementReadinessScore || 0).bar} transition-all duration-1000 ease-out`}
                          style={{ width: `${Math.min(100, Math.max(0, profile.placementReadinessScore || 0))}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-end">
                         <span className={`text-[10px] font-bold ${getReadinessStatus(profile.placementReadinessScore || 0).color} uppercase tracking-wider`}>
                           {getReadinessStatus(profile.placementReadinessScore || 0).text}
                         </span>
                      </div>
                    </div>

                    {/* Target Company */}
                    <div className="bg-surface-elevated/20 border border-border-dark p-3.5 rounded-2xl flex items-start gap-3">
                      <div className="p-2 bg-surface-elevated rounded-xl text-brand-400">
                        <FaBuilding className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-0.5">Target Company</span>
                        <span className="text-sm font-semibold text-text-primary">
                          {profile.dreamCompany || 'Not set'}
                        </span>
                      </div>
                    </div>

                    {/* Footer Stats */}
                    <div className="flex justify-between items-center pt-4 border-t border-border-dark">
                      <div className="text-xs text-text-muted">
                        <span className="font-mono">{profile.xp || 0}</span> XP
                      </div>
                      {profile.coins !== undefined && (
                         <div className="text-xs text-amber-400 font-semibold">
                           <span className="font-mono">{profile.coins}</span> Coins
                         </div>
                      )}
                    </div>
                  </div>
                  
                  {loading && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-surface-elevated overflow-hidden">
                      <div className="h-full bg-brand-500 w-1/3 animate-[slide_1s_ease-in-out_infinite]"></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
