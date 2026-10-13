import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { COSMETICS_CATALOG, CosmeticItem } from '../../../../frontend/src/config/cosmetics';
import { reviewPromotion } from '../../services/growthApiService';
import { 
  Coins, 
  Gift, 
  Banknote, 
  Sparkles, 
  Check, 
  AlertCircle, 
  Loader2, 
  Search, 
  X, 
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Palette
} from 'lucide-react';

interface AdminRewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: any;
  onSuccess: () => void;
  readOnly?: boolean;
}

export const AdminRewardModal: React.FC<AdminRewardModalProps> = ({
  isOpen,
  onClose,
  promotion,
  onSuccess,
  readOnly = false
}) => {
  const [coins, setCoins] = useState<number>(1000);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('INR');
  const [selectedCosmetics, setSelectedCosmetics] = useState<string[]>([]);
  const [adminMessage, setAdminMessage] = useState<string>('Thank you for promoting CrackPlace! Your reward is ready to claim.');
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const isClaimed = promotion?.rewardStatus === 'claimed';
  const isClaimable = promotion?.rewardStatus === 'claimable';
  const isViewOnly = readOnly || isClaimed;

  useEffect(() => {
    if (promotion) {
      const pkg = promotion.rewardPackage || promotion.rewardedItems;
      if (pkg && typeof pkg === 'object') {
        setCoins(Number(pkg.coins) || 0);
        setCashAmount(Number(pkg.cashAmount) || 0);
        setCurrency(pkg.currency || 'INR');
        setSelectedCosmetics(Array.isArray(pkg.cosmeticIds) ? pkg.cosmeticIds : []);
        setAdminMessage(pkg.message || promotion.adminMessage || 'Thank you for promoting CrackPlace! Your reward is ready to claim.');
      } else {
        setCoins(1000);
        setCashAmount(0);
        setCurrency('INR');
        setSelectedCosmetics([]);
        setAdminMessage(promotion.adminMessage || 'Thank you for promoting CrackPlace! Your reward is ready to claim.');
      }
      setError('');
    }
  }, [promotion]);

  if (!promotion) return null;

  const toggleCosmetic = (id: string) => {
    if (isViewOnly) return;
    setSelectedCosmetics(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const removeCosmetic = (id: string) => {
    if (isViewOnly) return;
    setSelectedCosmetics(prev => prev.filter(c => c !== id));
  };

  const handleGrant = async () => {
    if (isViewOnly) return;
    setError('');

    // Validation
    const parsedCoins = Number(coins);
    if (!Number.isInteger(parsedCoins) || parsedCoins < 0 || parsedCoins > 100000) {
      setError('Coins must be a positive integer between 0 and 100,000.');
      return;
    }

    const parsedCash = Number(cashAmount);
    if (isNaN(parsedCash) || parsedCash < 0 || parsedCash > 500000) {
      setError('Cash amount must be a number between 0 and 500,000.');
      return;
    }

    if (parsedCoins === 0 && parsedCash === 0 && selectedCosmetics.length === 0) {
      setError('Please configure at least one reward (Coins, Cosmetic item, or Cash).');
      return;
    }

    setSubmitting(true);
    try {
      await reviewPromotion(promotion.id, {
        status: 'approved',
        message: adminMessage.trim(),
        rewardDetails: {
          coins: parsedCoins,
          cashAmount: parsedCash,
          currency,
          cosmeticIds: selectedCosmetics
        }
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to grant reward package');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCatalog = COSMETICS_CATALOG.filter(item => {
    if (item.isFree) return false; // Only award premium catalog items
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'All Catalog' },
    { id: 'avatar', label: 'Avatars' },
    { id: 'theme', label: 'Themes' },
    { id: 'ring', label: 'Rings' },
    { id: 'frame', label: 'Frames' },
    { id: 'background', label: 'Backgrounds' },
    { id: 'title', label: 'Titles' },
    { id: 'emote', label: 'Emotes' },
    { id: 'sticker', label: 'Stickers' }
  ];

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'mythic': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300';
      case 'legendary': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
      case 'epic': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300';
      case 'rare': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const renderCosmeticVisual = (item: CosmeticItem) => {
    if (item.category === 'avatar') {
      const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(item.visual || item.id)}`;
      return <img src={url} alt={item.name} className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 object-cover" />;
    }
    if (item.category === 'theme') {
      return (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-sm">
          <Palette className="w-5 h-5" />
        </div>
      );
    }
    if (item.category === 'ring' || item.category === 'frame') {
      return (
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-amber-500 flex items-center justify-center bg-amber-50 dark:bg-amber-950/30 text-amber-600">
          <Sparkles className="w-4 h-4" />
        </div>
      );
    }
    if (item.category === 'background') {
      return (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-slate-800 to-indigo-900 border border-slate-700 flex items-center justify-center text-white text-xs">
          BG
        </div>
      );
    }
    if (item.category === 'emote' || item.category === 'sticker') {
      return (
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
          {item.visual || '✨'}
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
        <Sparkles className="w-4 h-4" />
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-indigo-600" />
          <span>{isViewOnly ? 'Promotion Reward Details' : isClaimable ? 'Edit Reward Package' : 'Configure Promotion Reward Package'}</span>
        </div>
      }
      subtitle={`User ID: ${promotion.userId} • Platform: ${promotion.platform?.toUpperCase()}`}
      maxWidth="4xl"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Status Banner */}
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isClaimed 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300' 
            : isClaimable 
            ? 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-300' 
            : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
        }`}>
          <div>
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isClaimed 
                  ? 'Reward Claimed by Creator' 
                  : isClaimable 
                  ? 'Reward Granted (Claimable by Creator)' 
                  : 'Pending Reward Assignment'}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              {isClaimed 
                ? `The creator claimed this reward on ${new Date(promotion.claimedAt || promotion.rewardPackage?.claimedAt || Date.now()).toLocaleString()}. Account credited.` 
                : isClaimable 
                ? 'Package is stored in database. Coins and items will only be credited to the creator once they click Claim Reward.'
                : 'Configure coins and real items from the Armory Catalog. They will remain claimable until collected.'}
            </p>
          </div>
          <a 
            href={promotion.videoUrl} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border shadow-xs hover:underline shrink-0"
          >
            <span>Watch Video</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. COIN REWARDS */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Coins className="w-4 h-4 text-amber-500" />
              <span>CrackPlace Coins</span>
            </label>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-full text-xs font-bold">
              <Coins className="w-3.5 h-3.5" />
              <span>+{Number(coins || 0).toLocaleString()} Coins</span>
            </div>
          </div>

          {!isViewOnly ? (
            <div className="space-y-2">
              <input 
                type="number"
                min="0"
                max="100000"
                step="100"
                value={coins}
                onChange={e => setCoins(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold"
                placeholder="e.g. 1000"
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs text-slate-400 self-center">Presets:</span>
                {[500, 1000, 2500, 5000, 10000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCoins(val)}
                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                  >
                    +{val.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCoins(0)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md text-red-600 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              +{Number(coins || 0).toLocaleString()} Coins
            </div>
          )}
        </div>

        {/* 2. COSMETICS CATALOG */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <label className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>Cosmetic Inventory Rewards ({selectedCosmetics.length} selected)</span>
              </label>
              <p className="text-xs text-slate-500">Select real catalog items (Themes, Avatars, Rings, Frames, Backgrounds).</p>
            </div>
            
            {!isViewOnly && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search item or ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Selected items tray */}
          {selectedCosmetics.length > 0 && (
            <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg flex flex-wrap gap-1.5">
              {selectedCosmetics.map(id => {
                const item = COSMETICS_CATALOG.find(c => c.id === id);
                return (
                  <span 
                    key={id}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 shadow-2xs"
                  >
                    <span>{item?.name || id}</span>
                    <span className="text-[10px] text-slate-400">({item?.category || 'item'})</span>
                    {!isViewOnly && (
                      <button 
                        type="button" 
                        onClick={() => removeCosmetic(id)}
                        className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {!isViewOnly && (
            <>
              {/* Category tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                {filteredCatalog.map(item => {
                  const isSelected = selectedCosmetics.includes(item.id);
                  return (
                    <div 
                      key={item.id}
                      onClick={() => toggleCosmetic(item.id)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-400 shadow-xs dark:bg-indigo-950/40 dark:border-indigo-600' 
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {renderCosmeticVisual(item)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-semibold text-xs text-slate-900 dark:text-white truncate">{item.name}</h4>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded border ${getRarityBadge(item.rarity)}`}>
                            {item.rarity}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{item.id}</p>
                      </div>
                    </div>
                  );
                })}
                {filteredCatalog.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-slate-400">
                    No matching cosmetic items found in catalog.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 3. CASH REWARDS (SEPARATE WORKFLOW) */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Banknote className="w-4 h-4 text-emerald-600" />
              <span>Real Cash Reward (INR)</span>
            </label>
            {cashAmount > 0 && (
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                ₹{Number(cashAmount).toLocaleString()} INR
              </span>
            )}
          </div>
          
          <p className="text-xs text-slate-500">
            Cash rewards do not convert to coins. If set &gt; 0, an auditable entry will appear in the Cash Payments tab for manual payout verification.
          </p>

          {!isViewOnly ? (
            <div className="flex gap-2">
              <input 
                type="number"
                min="0"
                max="500000"
                step="50"
                value={cashAmount}
                onChange={e => setCashAmount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-semibold"
                placeholder="0"
              />
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {cashAmount > 0 ? `₹${Number(cashAmount).toLocaleString()} ${currency}` : 'No cash reward assigned'}
            </div>
          )}
        </div>

        {/* 4. PERSONALIZED MESSAGE */}
        <div className="space-y-1.5">
          <label className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            <span>Personalized Message to Creator</span>
          </label>
          <textarea 
            rows={3}
            disabled={isViewOnly}
            value={adminMessage}
            onChange={e => setAdminMessage(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm"
            placeholder="Thank you for promoting CrackPlace! Your reward is ready to claim."
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isViewOnly ? 'Close' : 'Cancel'}
          </button>
          
          {!isViewOnly && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleGrant}
              className="px-6 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Granting Reward...</span>
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  <span>{isClaimable ? 'Save Package Updates' : 'Grant Reward Package'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
