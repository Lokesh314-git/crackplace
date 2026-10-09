import React, { useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaCoins, FaGift, FaMagnifyingGlass } from 'react-icons/fa6';
import { COSMETICS_CATALOG, getRingClass, getBackgroundClass, getFrameClass } from '../config/cosmetics';
import type { CosmeticItem } from '../config/cosmetics';
import { getAvatarImageUrl } from '../utils/avatarResolver';

export const Store: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [openingBox, setOpeningBox] = useState(false);
  const [boxResult, setBoxResult] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter and Sort states
  const [selectedCategory, setSelectedCategory] = useState<string>('avatar');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rarityFilter, setRarityFilter] = useState<string>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('price_asc');

  // Preview state (defaults to equipped or welcome placeholders)
  const [previewAvatar, setPreviewAvatar] = useState<string>(userProfile?.equippedAvatar || 'programmer');
  const [previewRing, setPreviewRing] = useState<string>(userProfile?.equippedRing || '');
  const [previewFrame, setPreviewFrame] = useState<string>(userProfile?.equippedFrame || '');
  const [previewBg, setPreviewBg] = useState<string>(userProfile?.equippedBackground || '');
  const [previewTitle, setPreviewTitle] = useState<string>(userProfile?.equippedTitle || '');

  if (!userProfile) return null;

  const tzOffset = 5.5 * 60 * 60 * 1000; // IST Timezone
  const todayStr = new Date(Date.now() + tzOffset).toISOString().split('T')[0];
  const isFreeSpin = userProfile.lastSpinDate !== todayStr;

  // Avatar resolution helper
  const getAvatarUrl = (visual: string) => {
    return getAvatarImageUrl(visual, visual);
  };

  // Check ownership (free items are always owned)
  const isOwned = (item: CosmeticItem) => {
    if (item.isFree || item.cost === 0) return true;
    let ownedList: string[] = [];
    if (item.category === 'avatar') ownedList = userProfile.unlockedAvatars || [];
    else if (item.category === 'ring') ownedList = userProfile.unlockedRings || [];
    else if (item.category === 'frame') ownedList = userProfile.unlockedFrames || [];
    else if (item.category === 'background') ownedList = userProfile.unlockedBackgrounds || [];
    else if (item.category === 'title') ownedList = userProfile.unlockedTitles || [];
    else if (item.category === 'theme') ownedList = userProfile.unlockedThemes || [];
    else if (item.category === 'emote') ownedList = userProfile.unlockedEmotes || [];
    else if (item.category === 'sticker') ownedList = userProfile.unlockedStickers || [];
    return ownedList.includes(item.id);
  };

  // Preview a shop item
  const handlePreviewItem = (item: CosmeticItem) => {
    if (item.category === 'avatar') setPreviewAvatar(item.id);
    else if (item.category === 'ring') setPreviewRing(item.id);
    else if (item.category === 'frame') setPreviewFrame(item.id);
    else if (item.category === 'background') setPreviewBg(item.id);
    else if (item.category === 'title') setPreviewTitle(item.id);
  };

  // Resolve preview title text dynamically
  const previewTitleItem = COSMETICS_CATALOG.find(i => i.id === previewTitle);
  const displayTitle = previewTitleItem ? previewTitleItem.visual : '';

  // Resolve preview avatar seed dynamically
  const previewAvatarItem = COSMETICS_CATALOG.find(i => i.id === previewAvatar);
  const displayAvatarSeed = previewAvatarItem ? previewAvatarItem.visual : previewAvatar;

  // Filtered store items
  const filteredItems = useMemo(() => {
    let items = COSMETICS_CATALOG.filter(item => item.category === selectedCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
    }

    if (rarityFilter !== 'all') {
      items = items.filter(item => item.rarity === rarityFilter);
    }

    if (ownershipFilter !== 'all') {
      items = items.filter(item => {
        const owned = isOwned(item);
        return ownershipFilter === 'owned' ? owned : !owned;
      });
    }

    items.sort((a, b) => {
      if (sortBy === 'price_asc') return a.cost - b.cost;
      if (sortBy === 'price_desc') return b.cost - a.cost;
      if (sortBy === 'rarity') {
        const rarityWeights = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, secret: 6 };
        return rarityWeights[b.rarity] - rarityWeights[a.rarity];
      }
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [selectedCategory, searchQuery, rarityFilter, ownershipFilter, sortBy, userProfile]);

  const handleSpin = async () => {
    if (spinning) return;
    setSpinning(true);
    setSpinResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const res = await fetch('/api/auth/lucky-spin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Lucky Spin failed');
      }
      const data = await res.json();
      // Relying on onSnapshot for state sync
      setSpinResult(data.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Spin execution failed');
    } finally {
      setSpinning(false);
    }
  };

  const handleOpenBox = async () => {
    if (openingBox) return;
    setOpeningBox(true);
    setBoxResult(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    try {
      const res = await fetch('/api/auth/mystery-box/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to open box');
      }
      const data = await res.json();
      // Relying on onSnapshot for state sync
      setBoxResult(data.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Box open failed');
    } finally {
      setOpeningBox(false);
    }
  };

  const handleBuyItem = async (itemId: string) => {
    setPurchasingId(itemId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch('/api/auth/store/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Purchase failed');
      }
      const data = await res.json();
      // Relying on onSnapshot for state sync
      setSuccessMessage(data.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Store purchase failed');
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fade-in">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border-dark">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-500"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Student Rewards</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight mt-1">Rewards & Armory</h1>
          <p className="text-text-secondary text-sm mt-0.5">Redeem practice coins for profile customizations, avatar frames, and daily rewards.</p>
        </div>

        {/* Balance displays */}
        <div className="flex gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-dark border border-border-dark text-amber-400 font-semibold text-xs shadow-xs">
            <FaCoins className="w-3.5 h-3.5" />
            <span>{userProfile.coins} Coins</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-dark border border-border-dark text-purple-400 font-semibold text-xs shadow-xs">
            <FaGift className="w-3.5 h-3.5" />
            <span>{userProfile.mysteryBoxes || 0} Reward Boxes</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-medium">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400 font-medium">
          {successMessage}
        </div>
      )}

      {/* Main grid section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Live Loadout Preview */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
          <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl space-y-4 shadow-xs">
            <div className="flex justify-between items-center border-b border-border-dark pb-2">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-text-muted">Profile Preview</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-elevated text-text-muted font-medium">Live</span>
            </div>

            {/* Simulated profile card with preview styles */}
            <div className={`p-5 rounded-xl border border-border-dark bg-surface-elevated/40 flex flex-col items-center text-center space-y-3 ${getBackgroundClass(previewBg)} ${getFrameClass(previewFrame)}`}>
              <div className="relative">
                <div className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-surface-dark border border-border-dark ${getRingClass(previewRing)}`}>
                  <img 
                    src={getAvatarUrl(displayAvatarSeed)} 
                    alt="Preview Avatar" 
                    className="w-14 h-14 rounded-full object-cover"
                  />
                </div>
                <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-brand-600 text-white text-[9px] font-bold flex items-center justify-center border border-surface-dark">
                  {userProfile.level}
                </span>
              </div>

              <div className="space-y-0.5">
                <h4 className="font-bold text-sm text-text-primary">{userProfile.displayName}</h4>
                {displayTitle && (
                  <span className="inline-block px-2 py-0.5 rounded bg-brand-600/10 text-brand-400 text-[10px] font-semibold border border-brand-500/20 uppercase">
                    {displayTitle}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-border-dark text-left text-xs">
                <div className="p-2 rounded-lg bg-surface-dark border border-border-dark">
                  <span className="text-[10px] text-text-muted block">Elo Rating</span>
                  <span className="font-bold text-brand-400 font-mono">{userProfile.battleRating}</span>
                </div>
                <div className="p-2 rounded-lg bg-surface-dark border border-border-dark">
                  <span className="text-[10px] text-text-muted block">Readiness</span>
                  <span className="font-bold text-emerald-400 font-mono">{userProfile.placementReadinessScore}%</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-text-muted text-center leading-relaxed">
              Click any item below to preview live before confirming unlock.
            </p>
          </div>
        </div>

        {/* Right Column: Catalog filters and grid list */}
        <div className="lg:col-span-8 space-y-5">
          
          {/* Custom filters panel card */}
          <div className="bg-surface-dark border border-border-dark p-4 rounded-2xl space-y-3 shadow-xs">
            
            {/* Category tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border-dark">
              {[
                { id: 'avatar', label: 'Avatars' },
                { id: 'ring', label: 'Rings' },
                { id: 'frame', label: 'Frames' },
                { id: 'background', label: 'Themes' },
                { id: 'title', label: 'Titles' },
                { id: 'theme', label: 'Styles' },
                { id: 'emote', label: 'Emotes' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === tab.id
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Inputs: Search, Rarity, Ownership, Sorting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              <div className="relative">
                <FaMagnifyingGlass className="absolute left-3 top-3 text-text-muted w-3 h-3" />
                <input
                  type="text"
                  placeholder="Search item..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-surface-elevated border border-border-dark text-xs text-text-primary focus:outline-hidden focus:border-brand-500"
                />
              </div>

              <div>
                <select
                  value={rarityFilter}
                  onChange={e => setRarityFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-dark text-xs text-text-secondary focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Rarities</option>
                  <option value="common">Common</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>

              <div>
                <select
                  value={ownershipFilter}
                  onChange={e => setOwnershipFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-dark text-xs text-text-secondary focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Items</option>
                  <option value="owned">Owned Only</option>
                  <option value="locked">Available Only</option>
                </select>
              </div>

              <div>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-dark text-xs text-text-secondary focus:outline-hidden cursor-pointer"
                >
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grid Layout of Items */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredItems.map(item => {
              const owned = isOwned(item);
              const previewing = (item.category === 'avatar' && previewAvatar === item.id) ||
                                 (item.category === 'ring' && previewRing === item.id) ||
                                 (item.category === 'frame' && previewFrame === item.id) ||
                                 (item.category === 'background' && previewBg === item.id) ||
                                 (item.category === 'title' && previewTitle === item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => handlePreviewItem(item)}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-all duration-150 cursor-pointer ${
                    previewing
                      ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/30'
                      : 'border-border-dark bg-surface-dark hover:border-slate-700 hover:bg-surface-elevated/40'
                  }`}
                >
                  {/* Category thumbnail preview */}
                  <div className="flex flex-col items-center justify-center text-center space-y-2 pt-1">
                    <div className="w-12 h-12 rounded-xl bg-surface-elevated border border-border-dark flex items-center justify-center overflow-hidden">
                      {item.category === 'avatar' && (
                        <img src={getAvatarUrl(item.visual)} alt={item.name} className="w-10 h-10 rounded-full" />
                      )}
                      {item.category === 'ring' && (
                        <div className={`w-10 h-10 rounded-full border bg-surface-dark ${getRingClass(item.id)}`} />
                      )}
                      {item.category === 'background' && (
                        <div className={`w-10 h-10 rounded-lg border ${getBackgroundClass(item.id)}`} />
                      )}
                      {item.category === 'frame' && (
                        <div className={`w-10 h-10 border ${getFrameClass(item.id)}`} />
                      )}
                      {item.category === 'title' && (
                        <span className="text-[10px] text-brand-400 font-bold uppercase">T</span>
                      )}
                      {item.category === 'emote' && (
                        <span className="text-xl leading-none">{item.visual}</span>
                      )}
                      {item.category === 'theme' && (
                        <span className="text-xl leading-none">🎨</span>
                      )}
                    </div>

                    <div className="space-y-0.5 w-full">
                      <h4 className="font-semibold text-xs text-text-primary truncate">{item.name}</h4>
                      <span className="text-[10px] text-text-muted capitalize">
                        {item.rarity}
                      </span>
                    </div>
                  </div>

                  {/* Pricing and Unlock Action button block */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-dark">
                    {(item.isFree || item.cost === 0) ? (
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                        FREE
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 shrink-0">
                        <FaCoins className="w-3 h-3" />
                        <span>{item.cost}</span>
                      </span>
                    )}

                    {owned ? (
                      <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-text-muted text-[10px] font-medium">
                        {(item.isFree || item.cost === 0) ? 'Available' : 'Owned'}
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBuyItem(item.id);
                        }}
                        disabled={purchasingId !== null || userProfile.coins < item.cost}
                        className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-surface-elevated disabled:text-text-muted disabled:cursor-not-allowed text-white font-semibold text-[10px] transition-colors cursor-pointer"
                      >
                        {purchasingId === item.id ? '...' : 'Unlock'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="col-span-full py-12 text-center text-xs text-text-muted bg-surface-dark border border-border-dark rounded-xl">
                No items match your selected filters.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Spin & Mystery Boxes Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border-dark">
        {/* Lucky Spin Card */}
        <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl flex flex-col justify-between items-center text-center space-y-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-text-primary">Daily Lucky Reward</h3>
            <p className="text-xs text-text-muted">Spin once daily for coin bundles, XP bonuses, or surprise chests.</p>
          </div>

          <div className="w-20 h-20 rounded-full border-2 border-dashed border-border-dark bg-surface-elevated flex items-center justify-center text-2xl">
            🎯
          </div>

          {spinResult && (
            <div className="p-2.5 rounded-lg border border-brand-500/30 bg-brand-500/10 text-xs font-medium text-brand-400">
              {spinResult}
            </div>
          )}

          <button
            onClick={handleSpin}
            disabled={spinning || (!isFreeSpin && userProfile.coins < 50)}
            className="w-full max-w-xs py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {spinning ? 'Evaluating...' : isFreeSpin ? 'Claim Free Daily Spin' : 'Spin (50 Coins)'}
          </button>
        </div>

        {/* Mystery Box Card */}
        <div className="bg-surface-dark border border-border-dark p-5 rounded-2xl flex flex-col justify-between items-center text-center space-y-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-text-primary">Reward Mystery Chest</h3>
            <p className="text-xs text-text-muted">Open earned boxes to unlock rare items and coin rewards.</p>
          </div>

          <div className="w-20 h-20 rounded-full border-2 border-dashed border-border-dark bg-surface-elevated flex items-center justify-center text-2xl">
            📦
          </div>

          {boxResult && (
            <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400">
              {boxResult}
            </div>
          )}

          <button
            onClick={handleOpenBox}
            disabled={openingBox || !userProfile.mysteryBoxes || userProfile.mysteryBoxes < 1}
            className="w-full max-w-xs py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {openingBox ? 'Opening...' : `Open Reward Box (${userProfile.mysteryBoxes || 0} remaining)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Store;
