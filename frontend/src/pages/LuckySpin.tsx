import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { FaCoins, FaBolt, FaGift, FaCrown, FaCheck, FaCircleExclamation, FaSpinner } from 'react-icons/fa6';
import { useAuthStore } from '../store/authStore';

interface WheelSector {
  id: string;
  label: string;
  shortLabel: string;
  type: 'coins' | 'xp' | 'mystery_box';
  value: number;
  color: string;
  accent: string;
}

const WHEEL_SECTORS: WheelSector[] = [
  { id: 'coins_10', label: '10 Coins', shortLabel: '10 COINS', type: 'coins', value: 10, color: '#1e293b', accent: '#38bdf8' },
  { id: 'coins_50', label: '50 Coins', shortLabel: '50 COINS', type: 'coins', value: 50, color: '#312e81', accent: '#818cf8' },
  { id: 'xp_50', label: '50 XP', shortLabel: '50 XP', type: 'xp', value: 50, color: '#0f172a', accent: '#34d399' },
  { id: 'xp_200', label: '200 XP', shortLabel: '200 XP', type: 'xp', value: 200, color: '#3b0764', accent: '#c084fc' },
  { id: 'mystery_box', label: 'Mystery Box', shortLabel: 'CHEST', type: 'mystery_box', value: 1, color: '#064e3b', accent: '#fbbf24' },
  { id: 'coins_100', label: '100 Coins', shortLabel: '100 COINS', type: 'coins', value: 100, color: '#172554', accent: '#60a5fa' },
  { id: 'jackpot', label: '500 XP', shortLabel: '500 XP', type: 'xp', value: 500, color: '#78350f', accent: '#facc15' },
];

const SLICE_ANGLE = 360 / WHEEL_SECTORS.length;
const SPIN_COST = 50;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export const LuckySpin: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const prefersReducedMotion = useReducedMotion();

  const [isRequesting, setIsRequesting] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonSector, setWonSector] = useState<WheelSector | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pendingProfileRef = useRef<any>(null);
  const spinTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);
      if (pendingProfileRef.current) {
        useAuthStore.setState({ userProfile: pendingProfileRef.current });
        pendingProfileRef.current = null;
      }
    };
  }, []);

  if (!userProfile) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const isFreeSpin = userProfile.lastSpinDate !== todayStr;
  const canAffordPaidSpin = (userProfile.coins || 0) >= SPIN_COST;
  const isDisabled = isRequesting || isSpinning || (!isFreeSpin && !canAffordPaidSpin);

  const handleSpin = async () => {
    if (isDisabled) return;
    setIsRequesting(true);
    setErrorMessage(null);
    setShowRewardModal(false);
    setWonSector(null);

    try {
      const res = await fetch('/api/auth/lucky-spin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lucky Spin failed');
      }

      const matchedIndex = WHEEL_SECTORS.findIndex((s) => s.id === data.sector?.id);
      const targetIndex = matchedIndex >= 0 ? matchedIndex : 0;
      const resolvedSector = WHEEL_SECTORS[targetIndex];

      if (data.profile) {
        pendingProfileRef.current = data.profile;
      }

      const targetMod = (360 - targetIndex * SLICE_ANGLE) % 360;
      const currentMod = ((rotation % 360) + 360) % 360;
      const delta = (targetMod - currentMod + 360) % 360;
      const extraSpins = prefersReducedMotion ? 0 : 360 * 6;
      const nextRotation = rotation + extraSpins + delta;

      setIsRequesting(false);
      setIsSpinning(true);
      setWonSector(resolvedSector);
      setRotation(nextRotation);

      const durationMs = prefersReducedMotion ? 220 : 4600;
      spinTimerRef.current = window.setTimeout(() => {
        if (pendingProfileRef.current) {
          useAuthStore.setState({ userProfile: pendingProfileRef.current });
          pendingProfileRef.current = null;
        }
        setIsSpinning(false);
        setShowRewardModal(true);
      }, durationMs);
    } catch (err: any) {
      setIsRequesting(false);
      setIsSpinning(false);
      setErrorMessage(err.message || 'Unable to spin right now.');
    }
  };

  const renderSectorIcon = (sector: WheelSector, sizeClass = 'w-6 h-6') => {
    if (sector.type === 'mystery_box') return <FaGift className={`${sizeClass} text-amber-400`} />;
    if (sector.id === 'jackpot') return <FaCrown className={`${sizeClass} text-yellow-300`} />;
    if (sector.type === 'xp') return <FaBolt className={`${sizeClass} text-purple-400`} />;
    return <FaCoins className={`${sizeClass} text-amber-400`} />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8 overflow-x-hidden">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider">
              Daily Rewards
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Daily Lucky Spin
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Spin the arena wheel once a day for free to win Coins, XP boosts, or a Mystery Chest.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <FaCoins className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Coins</div>
                <div className="text-sm font-bold text-white">{(userProfile.coins || 0).toLocaleString()}</div>
              </div>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2">
              <FaGift className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Chests</div>
                <div className="text-sm font-bold text-white">{userProfile.mysteryBoxes || 0}</div>
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

      {/* Wheel Stage */}
      <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-6 sm:p-10 flex flex-col items-center justify-center shadow-2xl overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.14)_0%,transparent_65%)]" />

        {/* Status Pill */}
        <div className="relative z-10 mb-6">
          {isFreeSpin ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Free Daily Spin Available
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300 text-xs font-medium">
              <FaCheck className="w-3 h-3 text-emerald-400" />
              Free Spin Claimed Today • Extra Spin: {SPIN_COST} Coins
            </span>
          )}
        </div>

        {/* Wheel + Fixed Top Pointer */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Fixed Top Pointer */}
          <div className="relative z-30 -mb-3.5 drop-shadow-[0_4px_12px_rgba(250,204,21,0.65)]">
            <svg width="36" height="34" viewBox="0 0 36 34" fill="none">
              <path
                d="M18 33L3 4C2.2 2.4 3.4 0.5 5.2 0.5H30.8C32.6 0.5 33.8 2.4 33 4L18 33Z"
                fill="url(#pointerGrad)"
                stroke="#fef08a"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="pointerGrad" x1="18" y1="0" x2="18" y2="33" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#fde047" />
                  <stop offset="1" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Outer Glowing Ring */}
          <div className="relative p-3 sm:p-4 rounded-full bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-2 border-purple-500/40 shadow-[0_0_50px_rgba(139,92,246,0.28)]">
            {/* Decorative Rim Dots */}
            {Array.from({ length: 14 }).map((_, idx) => {
              const angle = (idx * 360) / 14;
              return (
                <span
                  key={idx}
                  className={`absolute w-2 h-2 rounded-full ${
                    idx % 2 === 0 ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-purple-400 shadow-[0_0_8px_#c084fc]'
                  } ${isSpinning && !prefersReducedMotion ? 'animate-pulse' : ''}`}
                  style={{
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-156px)`,
                  }}
                />
              );
            })}

            {/* Rotating Wheel Container */}
            <div className="relative w-[280px] h-[280px] sm:w-[340px] sm:h-[340px] rounded-full overflow-hidden shadow-inner">
              <motion.div
                className="w-full h-full"
                animate={{ rotate: rotation }}
                transition={{
                  duration: prefersReducedMotion ? 0.2 : 4.5,
                  ease: [0.12, 0.85, 0.18, 1],
                }}
              >
                <svg viewBox="0 0 320 320" className="w-full h-full">
                  <defs>
                    <radialGradient id="wheelCenterGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                      <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
                    </radialGradient>
                  </defs>

                  {WHEEL_SECTORS.map((sector, idx) => {
                    const startAngle = idx * SLICE_ANGLE - SLICE_ANGLE / 2;
                    const endAngle = idx * SLICE_ANGLE + SLICE_ANGLE / 2;
                    const midAngle = idx * SLICE_ANGLE;
                    const path = createSlicePath(160, 160, 156, startAngle, endAngle);

                    return (
                      <g key={sector.id}>
                        <path
                          d={path}
                          fill={sector.color}
                          stroke="rgba(148,163,184,0.3)"
                          strokeWidth="1.5"
                        />
                        <g transform={`rotate(${midAngle} 160 160)`}>
                          <circle cx="160" cy="48" r="5" fill={sector.accent} />
                          <text
                            x="160"
                            y="76"
                            textAnchor="middle"
                            fill="#f8fafc"
                            fontSize="11"
                            fontWeight="800"
                            letterSpacing="0.04em"
                          >
                            {sector.shortLabel}
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  <circle cx="160" cy="160" r="156" fill="url(#wheelCenterGlow)" pointerEvents="none" />
                  <circle cx="160" cy="160" r="155" fill="none" stroke="rgba(250,204,21,0.35)" strokeWidth="2.5" />
                </svg>
              </motion.div>

              {/* Center Hub Button */}
              <button
                type="button"
                onClick={handleSpin}
                disabled={isDisabled}
                aria-label="Spin Lucky Wheel"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-extrabold text-xs sm:text-sm uppercase tracking-wider border-4 border-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.55)] hover:scale-105 active:scale-95 transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex flex-col items-center justify-center"
              >
                {isRequesting || isSpinning ? (
                  <FaSpinner className="w-5 h-5 animate-spin" />
                ) : (
                  <span>SPIN</span>
                )}
              </button>
            </div>
          </div>

          {/* Action Button Below Wheel */}
          <div className="mt-8 w-full max-w-xs">
            <button
              type="button"
              onClick={handleSpin}
              disabled={isDisabled}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequesting
                ? 'Authorizing Spin...'
                : isSpinning
                  ? 'Spinning Wheel...'
                  : isFreeSpin
                    ? 'Claim Free Daily Spin'
                    : canAffordPaidSpin
                      ? `Spin Again (${SPIN_COST} Coins)`
                      : `Need ${SPIN_COST} Coins to Spin`}
            </button>
          </div>
        </div>
      </div>

      {/* Reward Reveal Popup */}
      <AnimatePresence>
        {showRewardModal && wonSector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setShowRewardModal(false)}
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.82, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-amber-400/40 p-6 text-center text-white shadow-[0_0_60px_rgba(251,191,36,0.25)] space-y-4"
            >
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-400/40 flex items-center justify-center shadow-inner">
                {renderSectorIcon(wonSector, 'w-8 h-8')}
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  {wonSector.id === 'jackpot' ? 'Jackpot Reward!' : 'Reward Unlocked!'}
                </p>
                <h2 className="text-2xl font-extrabold text-white">{wonSector.label}</h2>
                <p className="text-xs text-slate-400">
                  Your reward has been credited to your account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Awesome!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LuckySpin;
