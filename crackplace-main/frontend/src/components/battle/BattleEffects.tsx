import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const EntranceEffect: React.FC<{ type: string | null; onComplete: () => void }> = ({ type, onComplete }) => {
  useEffect(() => {
    if (type) {
      const timer = setTimeout(onComplete, 3000); // 3 second entrance animation
      return () => clearTimeout(timer);
    } else {
      onComplete(); // Instantly complete if no effect
    }
  }, [type, onComplete]);

  if (!type) return null;

  const renderEffect = () => {
    switch (type) {
      case 'entrance_lightning':
      case 'lightning':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 1, 0.8, 1, 0], scale: 1 }}
            transition={{ duration: 3, times: [0, 0.1, 0.2, 0.5, 1] }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-blue-900/40"
          >
            <div className="text-blue-400 font-bold text-6xl tracking-widest uppercase animate-pulse drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">
              ⚡ CHALLENGER APPROACHES ⚡
            </div>
          </motion.div>
        );
      case 'entrance_glitch':
      case 'cyber_glitch':
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1, 0], x: [0, -10, 10, -5, 0] }}
            transition={{ duration: 3, times: [0, 0.2, 0.4, 0.6, 1] }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-emerald-900/40"
          >
            <div className="text-emerald-400 font-mono font-bold text-6xl uppercase drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]">
              // SYSTEM_BREACH //
            </div>
          </motion.div>
        );
      case 'entrance_burst':
      case 'cosmic_burst':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 2] }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-purple-900/40"
          >
            <div className="text-purple-400 font-bold text-6xl uppercase tracking-widest drop-shadow-[0_0_20px_rgba(168,85,247,0.8)]">
              ✧ COSMIC ARRIVAL ✧
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {renderEffect()}
    </AnimatePresence>
  );
};

export const VictoryEffect: React.FC<{ type: string | null; winnerName: string }> = ({ type, winnerName }) => {
  if (!type) return null;

  const renderEffect = () => {
    switch (type) {
      case 'victory_golden':
      case 'golden':
        return (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none bg-gradient-to-b from-amber-500/30 to-transparent"
          >
            <div className="text-amber-400 font-bold text-7xl uppercase tracking-widest drop-shadow-[0_0_30px_rgba(251,191,36,1)] mb-4">
              VICTORY
            </div>
            <div className="text-white text-2xl font-semibold drop-shadow-md">
              {winnerName} rules the arena
            </div>
          </motion.div>
        );
      case 'victory_ai':
      case 'ai_core':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none bg-cyan-900/30 backdrop-blur-sm"
          >
            <div className="text-cyan-400 font-mono font-bold text-6xl uppercase tracking-widest drop-shadow-[0_0_30px_rgba(34,211,238,1)] mb-4">
              ASSESSMENT PASSED
            </div>
            <div className="text-cyan-200 text-xl font-mono">
              [ {winnerName.toUpperCase()} :: DOMINANCE VERIFIED ]
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {renderEffect()}
    </AnimatePresence>
  );
};
