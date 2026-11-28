import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FaGift, FaCoins, FaBolt, FaCrown, FaLock, FaCircleExclamation, FaCheck } from 'react-icons/fa6';
import { useAuthStore } from '../store/authStore';

interface BoxLoot {
  type: 'coins' | 'xp' | 'frame';
  value: number | string;
  label: string;
}

type ChestStage = 'idle' | 'charging' | 'opening' | 'revealed';

function getLootRarity(loot: BoxLoot | null) {
  if (!loot) return { name: 'Common', badge: 'bg-slate-700 text-slate-200', border: 'border-slate-500/40', glow: 'shadow-slate-500/20' };
  if (loot.type === 'frame') {
    return { name: 'Legendary', badge: 'bg-amber-500/20 text-amber-300 border border-amber-400/40', border: 'border-amber-400/60', glow: 'shadow-[0_0_45px_rgba(251,191,36,0.35)]' };
  }
  if ((loot.type === 'xp' && Number(loot.value) >= 750) || (loot.type === 'coins' && Number(loot.value) >= 300)) {
    return { name: 'Epic', badge: 'bg-purple-500/20 text-purple-300 border border-purple-400/40', border: 'border-purple-400/60', glow: 'shadow-[0_0_40px_rgba(168,85,247,0.35)]' };
  }
  return { name: 'Rare', badge: 'bg-blue-500/20 text-blue-300 border border-blue-400/40', border: 'border-blue-400/50', glow: 'shadow-[0_0_35px_rgba(59,130,246,0.3)]' };
}

export const MysteryChest: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();

  const [stage, setStage] = useState<ChestStage>('idle');
  const [isRequesting, setIsRequesting] = useState(false);
  const [revealedLoot, setRevealedLoot] = useState<BoxLoot | null>(null);
  const [collectedMessage, setCollectedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pendingProfileRef = useRef<any>(null);
  const timersRef = useRef<number[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    return () => {
      clearAllTimers();
      if (pendingProfileRef.current) {
        useAuthStore.setState({ userProfile: pendingProfileRef.current });
        pendingProfileRef.current = null;
      }
    };
  }, []);

  if (!userProfile) return null;

  const chestCount = userProfile.mysteryBoxes || 0;
  const canOpen = chestCount > 0 && stage === 'idle' && !isRequesting;

  const handleOpenChest = async () => {
    if (!canOpen) return;
    setIsRequesting(true);
    setErrorMessage(null);
    setCollectedMessage(null);
    setRevealedLoot(null);

    try {
      const res = await fetch('/api/auth/mystery-box/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to open Mystery Chest');
      }

      if (data.profile) {
        pendingProfileRef.current = data.profile;
      }
      setRevealedLoot(data.loot || { type: 'coins', value: 100, label: data.message || 'Mystery Reward' });
      setIsRequesting(false);

      if (prefersReducedMotion) {
        setStage('revealed');
        return;
      }

      // 5-Stage Sequence: idle -> charging -> opening -> revealed -> collect
      setStage('charging');
      const t1 = window.setTimeout(() => {
        setStage('opening');
      }, 950);
      const t2 = window.setTimeout(() => {
        setStage('revealed');
      }, 1750);
      timersRef.current.push(t1, t2);
    } catch (err: any) {
      setIsRequesting(false);
      setStage('idle');
      setErrorMessage(err.message || 'Could not open chest.');
    }
  };

  const handleCollect = () => {
    if (pendingProfileRef.current) {
      useAuthStore.setState({ userProfile: pendingProfileRef.current });
      pendingProfileRef.current = null;
    }
    if (revealedLoot) {
      setCollectedMessage(`Collected ${revealedLoot.label}!`);
    }
    setStage('idle');
    setRevealedLoot(null);
  };

  const rarity = getLootRarity(revealedLoot);

  const renderLootIcon = (loot: BoxLoot | null) => {
    if (!loot) return <FaGift className="w-8 h-8 text-emerald-400" />;
    if (loot.type === 'frame') return <FaCrown className="w-9 h-9 text-amber-300" />;
    if (loot.type === 'xp') return <FaBolt className="w-9 h-9 text-purple-300" />;
    return <FaCoins className="w-9 h-9 text-amber-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 overflow-x-hidden">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-amber-600/15 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
              Daily Rewards
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Mystery Chest Vault
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Unlock your earned Mystery Chests for Coin bundles, XP jackpots, and exclusive avatar frames.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
              <FaGift className={`w-4 h-4 ${chestCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Available</div>
                <div className="text-sm font-bold text-white">{chestCount} Chest{chestCount === 1 ? '' : 's'}</div>
              </div>
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
              <FaCoins className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Coins</div>
                <div className="text-sm font-bold text-white">{(userProfile.coins || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs sm:text-sm">
          <FaCircleExclamation className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {collectedMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm">
          <FaCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{collectedMessage}</span>
        </div>
      )}

      {/* 3D Chest Arena */}
      <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 sm:p-12 flex flex-col items-center justify-center min-h-[420px] shadow-2xl overflow-hidden">
        {/* Ambient Radial Glow */}
        <motion.div
          className="pointer-events-none absolute w-80 h-80 rounded-full blur-3xl"
          animate={{
            opacity: stage === 'charging' ? 0.75 : stage === 'opening' || stage === 'revealed' ? 0.9 : chestCount > 0 ? 0.35 : 0.1,
            scale: stage === 'opening' ? 1.35 : stage === 'charging' ? 1.15 : 1,
          }}
          transition={{ duration: 0.5 }}
          style={{
            background:
              stage === 'opening' || stage === 'revealed'
                ? 'radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(16,185,129,0.15) 55%, transparent 75%)'
                : 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(139,92,246,0.2) 60%, transparent 75%)',
          }}
        />

        {/* Burst Particles during Opening / Revealed */}
        <AnimatePresence>
          {(stage === 'charging' || stage === 'opening') && !prefersReducedMotion && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 360) / 12;
                const dist = stage === 'opening' ? 145 : 70;
                const rad = (angle * Math.PI) / 180;
                return (
                  <motion.span
                    key={i}
                    initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                    animate={
                      stage === 'charging'
                        ? {
                            x: [Math.cos(rad) * 110, Math.cos(rad) * 16],
                            y: [Math.sin(rad) * 110, Math.sin(rad) * 16],
                            opacity: [0, 1, 0],
                            scale: [0.5, 1.1, 0.3],
                          }
                        : {
                            x: Math.cos(rad) * dist,
                            y: Math.sin(rad) * dist - 20,
                            opacity: [1, 1, 0],
                            scale: [0.6, 1.4, 0.2],
                          }
                    }
                    transition={{ duration: stage === 'charging' ? 0.9 : 0.85, ease: 'easeOut' }}
                    className={`absolute w-2.5 h-2.5 rounded-full ${
                      i % 2 === 0 ? 'bg-amber-300 shadow-[0_0_12px_#fbbf24]' : 'bg-emerald-300 shadow-[0_0_12px_#34d399]'
                    }`}
                  />
                );
              })}
            </div>
          )}
        </AnimatePresence>

        {/* Reward Reveal Card (Stage 4 & 5) */}
        <AnimatePresence mode="wait">
          {stage === 'revealed' && revealedLoot ? (
            <motion.div
              key="revealed-card"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.75 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 240, damping: 20 }}
              className={`relative z-20 w-full max-w-sm rounded-2xl bg-slate-900/95 border ${rarity.border} ${rarity.glow} p-6 text-center text-white space-y-4`}
            >
              <div className="flex justify-center">
                <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${rarity.badge}`}>
                  {rarity.name} Drop
                </span>
              </div>

              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 via-slate-800 to-emerald-500/20 border border-amber-400/40 flex items-center justify-center shadow-inner">
                {renderLootIcon(revealedLoot)}
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-extrabold text-white">{revealedLoot.label}</h2>
                <p className="text-xs text-slate-400">
                  {revealedLoot.type === 'frame'
                    ? 'New avatar frame unlocked in your Armory!'
                    : 'Ready to add to your CrackPlace balance.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCollect}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-900/30 transition-all cursor-pointer"
              >
                Collect Reward
              </button>
            </motion.div>
          ) : (
            /* 3D-Styled Treasure Chest (Stages 1-3) */
            <motion.div
              key="chest-visual"
              className="relative z-10 flex flex-col items-center"
              animate={
                stage === 'charging' && !prefersReducedMotion
                  ? {
                      x: [-4, 5, -6, 6, -4, 4, 0],
                      rotate: [-2, 2.5, -3, 3, -2, 0],
                      scale: [1, 1.05, 1.08],
                    }
                  : stage === 'opening' && !prefersReducedMotion
                    ? { scale: [1.08, 1.14, 1.05] }
                    : { y: chestCount > 0 && !prefersReducedMotion ? [0, -6, 0] : 0 }
              }
              transition={
                stage === 'charging'
                  ? { duration: 0.45, repeat: Infinity }
                  : stage === 'opening'
                    ? { duration: 0.6 }
                    : { duration: 3, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              {/* Chest Container with 3D Perspective */}
              <div className="relative w-48 h-44 sm:w-56 sm:h-48" style={{ perspective: '800px' }}>
                {/* Golden Light Beam from inside when opening */}
                {(stage === 'opening') && (
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0.2 }}
                    animate={{ opacity: 0.95, scaleY: 1.25 }}
                    transition={{ duration: 0.5 }}
                    className="absolute -top-16 left-1/2 -translate-x-1/2 w-36 h-32 bg-gradient-to-t from-amber-300/80 via-amber-200/30 to-transparent blur-md rounded-t-full pointer-events-none"
                  />
                )}

                {/* Chest Lid */}
                <motion.div
                  animate={{
                    rotateX: stage === 'opening' ? -115 : 0,
                  }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  style={{ transformOrigin: 'bottom center', transformStyle: 'preserve-3d' }}
                  className={`relative z-20 mx-auto w-44 sm:w-52 h-16 sm:h-18 rounded-t-3xl border-2 ${
                    chestCount > 0 || stage !== 'idle'
                      ? 'bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 border-amber-400/70 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                      : 'bg-gradient-to-b from-slate-700 to-slate-800 border-slate-600'
                  }`}
                >
                  {/* Metallic Lid Straps */}
                  <div className="absolute inset-y-0 left-6 w-3.5 bg-gradient-to-b from-amber-300 to-amber-600 opacity-85" />
                  <div className="absolute inset-y-0 right-6 w-3.5 bg-gradient-to-b from-amber-300 to-amber-600 opacity-85" />
                  <div className="absolute bottom-0 inset-x-0 h-2.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
                </motion.div>

                {/* Chest Base */}
                <div
                  className={`relative z-10 mx-auto -mt-1 w-44 sm:w-52 h-24 sm:h-28 rounded-b-2xl border-2 border-t-0 flex items-center justify-center ${
                    chestCount > 0 || stage !== 'idle'
                      ? 'bg-gradient-to-b from-amber-900 via-amber-950 to-slate-950 border-amber-500/60 shadow-2xl'
                      : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700'
                  }`}
                >
                  <div className="absolute inset-y-0 left-6 w-3.5 bg-gradient-to-b from-amber-400 to-amber-700 opacity-80" />
                  <div className="absolute inset-y-0 right-6 w-3.5 bg-gradient-to-b from-amber-400 to-amber-700 opacity-80" />

                  {/* Center Glowing Lock */}
                  <div
                    className={`relative z-20 -mt-12 w-11 h-12 rounded-xl border-2 flex items-center justify-center transition-all ${
                      stage === 'charging'
                        ? 'bg-amber-300 border-white shadow-[0_0_30px_#fde047] scale-110'
                        : chestCount > 0
                          ? 'bg-gradient-to-b from-amber-300 to-amber-500 border-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                          : 'bg-slate-700 border-slate-500'
                    }`}
                  >
                    {chestCount > 0 || stage !== 'idle' ? (
                      <div className="w-2.5 h-4 rounded-full bg-slate-950" />
                    ) : (
                      <FaLock className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 w-full max-w-xs text-center space-y-2">
                <button
                  type="button"
                  onClick={handleOpenChest}
                  disabled={!canOpen}
                  className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {isRequesting
                    ? 'Unlocking Chest...'
                    : stage === 'charging'
                      ? 'Charging Energy...'
                      : stage === 'opening'
                        ? 'Opening Chest...'
                        : chestCount > 0
                          ? `Open Mystery Chest (${chestCount} Left)`
                          : 'No Mystery Chests Available'}
                </button>
                {chestCount === 0 && stage === 'idle' && (
                  <p className="text-[11px] text-slate-400">
                    Win Mystery Chests from the Daily Lucky Spin!
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MysteryChest;
