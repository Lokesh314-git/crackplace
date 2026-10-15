import React, { useState, useEffect } from 'react';
import { 
  FaCoins, 
  FaGift, 
  FaCheck, 
  FaCircleCheck, 
  FaXmark, 
  FaQuoteLeft, 
  FaArrowUpRightFromSquare, 
  FaWandMagicSparkles, 
  FaMoneyBillWave,
  FaPalette,
  FaShieldHalved
} from 'react-icons/fa6';
import { 
  COSMETICS_CATALOG, 
  getRingClass, 
  getBackgroundClass, 
  getFrameClass, 
  getRarityColor,
  type CosmeticItem 
} from '../config/cosmetics';
import { getAvatarImageUrl } from '../utils/avatarResolver';

interface PromotionRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: any;
  cashRewards?: any[];
  token: string | null;
  onClaimSuccess: () => void;
}

export const PromotionRewardModal: React.FC<PromotionRewardModalProps> = ({
  isOpen,
  onClose,
  promotion,
  cashRewards = [],
  token,
  onClaimSuccess
}) => {
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [claimedState, setClaimedState] = useState<boolean>(false);
  const [claimedTimestamp, setClaimedTimestamp] = useState<string | null>(null);
  const [grantedSummary, setGrantedSummary] = useState<any | null>(null);

  useEffect(() => {
    if (promotion) {
      const isAlreadyClaimed = promotion.rewardStatus === 'claimed';
      setClaimedState(isAlreadyClaimed);
      setClaimedTimestamp(promotion.claimedAt || promotion.rewardPackage?.claimedAt || null);
      setError('');
      setGrantedSummary(null);
    }
  }, [promotion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !promotion) return null;

  const rewardPackage = promotion.rewardPackage || promotion.rewardedItems;
  const coins = Number(rewardPackage?.coins) || 0;
  const cosmeticIds: string[] = Array.isArray(rewardPackage?.cosmeticIds) ? rewardPackage.cosmeticIds : [];
  const cashAmount = Number(rewardPackage?.cashAmount) || 0;
  const currency = rewardPackage?.currency || 'INR';
  const customMessage = rewardPackage?.message || promotion.adminMessage || 'Thank you for promoting CrackPlace! Review your gifts and claim your rewards.';

  // Check matching cash reward status if cash was granted
  const matchingCash = cashRewards.find((c: any) => c.promotionId === promotion.id);
  const cashStatus = matchingCash?.status || (cashAmount > 0 ? 'Pending Payment' : null);

  const isClaimable = !claimedState && (promotion.rewardStatus === 'claimable' || (!promotion.rewardStatus && rewardPackage));

  const handleClaim = async () => {
    if (!token || claiming || !isClaimable) return;
    setClaiming(true);
    setError('');

    try {
      const response = await fetch(`/api/invite-promote/promotions/${promotion.id}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim rewards');
      }

      setClaimedState(true);
      setClaimedTimestamp(data.claimedAt || new Date().toISOString());
      setGrantedSummary(data);

      // Trigger celebratory event for wallet / profile listeners
      if (data.coinsGranted > 0) {
        window.dispatchEvent(new CustomEvent('coins-earned', { detail: { amount: data.coinsGranted } }));
      }

      onClaimSuccess();
    } catch (err: any) {
      console.error('Claim error:', err);
      setError(err.message || 'An error occurred while claiming your reward.');
    } finally {
      setClaiming(false);
    }
  };

  const renderCosmeticVisual = (item: CosmeticItem) => {
    if (item.category === 'avatar') {
      const avatarUrl = getAvatarImageUrl(item.visual, item.visual);
      return (
        <img 
          src={avatarUrl} 
          alt={item.name} 
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-indigo-400 bg-slate-100 object-cover shadow-sm shrink-0"
        />
      );
    }
    if (item.category === 'theme') {
      let gradient = 'from-indigo-600 via-purple-600 to-pink-500';
      if (item.id === 'theme_matrix') gradient = 'from-emerald-950 via-emerald-800 to-black';
      else if (item.id === 'theme_cyberpunk') gradient = 'from-pink-500 via-purple-600 to-yellow-400';
      else if (item.id === 'theme_ocean_blue') gradient = 'from-blue-600 to-cyan-500';
      else if (item.id === 'theme_golden_legend') gradient = 'from-amber-500 to-yellow-400';
      else if (item.id === 'theme_crimson') gradient = 'from-red-600 to-rose-800';
      else if (item.id === 'theme_emerald') gradient = 'from-emerald-600 to-green-700';
      else if (item.id === 'theme_space') gradient = 'from-slate-900 via-indigo-950 to-purple-950';

      return (
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-tr ${gradient} flex items-center justify-center text-white shadow-sm border border-white/20 shrink-0`}>
          <FaPalette className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
      );
    }
    if (item.category === 'ring') {
      return (
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-slate-900/5 shrink-0 ${getRingClass(item.id)}`}>
          <FaWandMagicSparkles className="w-4 h-4 text-amber-500" />
        </div>
      );
    }
    if (item.category === 'frame') {
      return (
        <div className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-slate-900/5 shrink-0 ${getFrameClass(item.id)}`}>
          <FaShieldHalved className="w-5 h-5 text-indigo-500" />
        </div>
      );
    }
    if (item.category === 'background') {
      return (
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex items-center justify-center text-white text-xs font-bold shadow-xs shrink-0 ${getBackgroundClass(item.id)}`}>
          BG
        </div>
      );
    }
    if (item.category === 'emote' || item.category === 'sticker') {
      return (
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-100 flex items-center justify-center text-xl sm:text-2xl shadow-xs shrink-0">
          {item.visual || '✨'}
        </div>
      );
    }
    return (
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
        <FaWandMagicSparkles className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div className="relative w-[calc(100vw-24px)] max-w-xl sm:max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden z-10 animate-in zoom-in-95 duration-200 max-h-[92vh] sm:max-h-[88vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 p-4.5 sm:p-6 text-white shrink-0 relative">
          {/* Top Bar: Badges on left, Close button on right (never overlapping) */}
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 pr-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white shadow-2xs shrink-0">
                <FaGift className="w-3 h-3 shrink-0" />
                <span>{promotion.platform || 'Promotion'} Reward</span>
              </span>

              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                claimedState 
                  ? 'bg-emerald-400/30 text-emerald-100 border border-emerald-300/40' 
                  : 'bg-amber-400/30 text-amber-100 border border-amber-300/40 animate-pulse'
              }`}>
                {claimedState ? 'Reward Claimed' : 'Waiting To Claim'}
              </span>
            </div>

            <button
              onClick={onClose}
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer shrink-0 ml-auto"
              aria-label="Close modal"
            >
              <FaXmark className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Your Promotion Rewards</h2>
          <p className="text-blue-100/90 text-xs sm:text-[13px] mt-1 leading-relaxed max-w-lg">
            Thank you for promoting CrackPlace! Review your gifts below and claim your rewards directly to your account.
          </p>

          <div className="mt-3 pt-2.5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[11px] text-blue-200 min-w-0">
            <span className="font-semibold text-blue-100 shrink-0">Video Link:</span>
            <a 
              href={promotion.videoUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="text-white font-medium hover:underline inline-flex items-center gap-1.5 break-all sm:truncate max-w-full"
              title={promotion.videoUrl}
            >
              <span className="truncate">{promotion.videoUrl}</span>
              <FaArrowUpRightFromSquare className="w-2.5 h-2.5 shrink-0 text-blue-200" />
            </a>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto overscroll-contain flex-1">
          {/* Personalized Message Card */}
          {customMessage && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 sm:p-4 relative">
              <div className="flex items-start gap-2">
                <FaQuoteLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 italic leading-relaxed">
                    "{customMessage}"
                  </p>
                  <div className="text-[10px] text-right font-bold text-indigo-600 mt-1 uppercase tracking-wider">
                    — CrackPlace Team
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <span className="font-bold">Error:</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Claimed Notification if just claimed */}
          {grantedSummary && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
                <FaCircleCheck className="w-4 h-4 shrink-0" />
                <span>Rewards Added to Your Account!</span>
              </div>
              <p className="text-xs text-emerald-600 leading-relaxed">
                {grantedSummary.coinsGranted > 0 && `+${grantedSummary.coinsGranted.toLocaleString()} Coins have been credited to your wallet balance. `}
                {grantedSummary.cosmeticsGranted?.length > 0 && `${grantedSummary.cosmeticsGranted.length} cosmetic item(s) are now unlocked in your Armory & Personalization.`}
              </p>
            </div>
          )}

          {/* Reward Cards Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-2 pb-1.5 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
                Granted Reward Items
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 sm:text-slate-400">
                {coins > 0 ? '1 Coin Reward • ' : ''}
                {cosmeticIds.length} Cosmetic(s)
                {cashAmount > 0 ? ' • 1 Cash Bounty' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* 1. COIN REWARD CARD */}
              {coins > 0 && (
                <div className="bg-gradient-to-r from-amber-50/90 to-amber-100/60 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4.5 shadow-xs transition-all hover:border-amber-300">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Icon Container */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-500/15 border border-amber-300/80 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                      <FaCoins className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500 drop-shadow-xs" />
                    </div>

                    {/* Reward Details & Responsive Status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-800">
                            Currency Reward
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900 uppercase">
                            Instant Credit
                          </span>
                        </div>

                        <div className="shrink-0">
                          <span className={`inline-flex items-center text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 sm:py-1 rounded-full ${
                            claimedState 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-amber-200/80 text-amber-950 border border-amber-300'
                          }`}>
                            {claimedState ? 'Claimed' : 'Waiting to Claim'}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                        +{coins.toLocaleString()} Coins
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed mt-1">
                        Authoritative wallet coins for Armory cosmetics, Store items, and Battle rounds.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. COSMETIC REWARD CARDS */}
              {cosmeticIds.map(cosmeticId => {
                const item = COSMETICS_CATALOG.find(c => c.id === cosmeticId);
                const itemName = item?.name || cosmeticId;
                const category = item?.category || 'Cosmetic';
                const rarity = item?.rarity || 'epic';
                const description = item?.description || 'Exclusive creator cosmetic item.';

                return (
                  <div 
                    key={cosmeticId}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4.5 shadow-xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Cosmetic Visual */}
                      <div className="shrink-0 flex items-center justify-center mt-0.5 sm:mt-0">
                        {item ? renderCosmeticVisual(item) : (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                            <FaWandMagicSparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                        )}
                      </div>

                      {/* Reward Details & Responsive Status */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getRarityColor(rarity)}`}>
                              {rarity}
                            </span>
                            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              {category}
                            </span>
                          </div>

                          <div className="shrink-0">
                            <span className={`inline-flex items-center text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 sm:py-1 rounded-full ${
                              claimedState 
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            }`}>
                              {claimedState ? 'Unlocked' : 'Claimable'}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                          {itemName}
                        </h4>

                        <p className="text-xs text-slate-600 leading-relaxed mt-1">
                          {description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 3. CASH REWARD CARD (SEPARATE WORKFLOW) */}
              {cashAmount > 0 && (
                <div className="bg-gradient-to-r from-emerald-50/90 to-teal-50/60 border border-emerald-200/90 rounded-2xl p-3.5 sm:p-4.5 shadow-xs transition-all hover:border-emerald-300">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Cash Icon */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-emerald-500/15 border border-emerald-300/80 flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0">
                      <FaMoneyBillWave className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600" />
                    </div>

                    {/* Details & Status */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">
                            Real Cash Bounty
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 uppercase">
                            Bank / UPI Transfer
                          </span>
                        </div>

                        <div className="shrink-0">
                          <span className={`inline-flex items-center text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 sm:py-1 rounded-full ${
                            cashStatus === 'Paid' || cashStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {cashStatus ? cashStatus.toUpperCase() : 'PENDING'}
                          </span>
                        </div>
                      </div>

                      <h4 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                        ₹{cashAmount.toLocaleString()} {currency}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed mt-1">
                        Cash rewards are audited and disbursed directly to your bank account or UPI by our administrative team.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-3.5 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 text-center sm:text-left w-full sm:w-auto">
            {claimedState ? (
              <span className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-emerald-700 font-semibold">
                <FaCircleCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Claimed on {claimedTimestamp ? new Date(claimedTimestamp).toLocaleString() : 'Recent'}</span>
              </span>
            ) : (
              <span className="text-slate-600">Click Claim Reward below to credit these items to your account.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer text-center min-h-[40px] flex items-center justify-center"
            >
              Close
            </button>

            {isClaimable ? (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[40px]"
              >
                {claiming ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Claiming Rewards...</span>
                  </>
                ) : (
                  <>
                    <FaGift className="w-4 h-4 shrink-0" />
                    <span>Claim Reward</span>
                  </>
                )}
              </button>
            ) : (
              <button
                disabled
                className="flex-1 sm:flex-initial px-5 sm:px-6 py-2.5 rounded-xl bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed min-h-[40px]"
              >
                <FaCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Reward Claimed</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
