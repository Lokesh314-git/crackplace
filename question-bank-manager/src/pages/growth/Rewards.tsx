import React, { useEffect, useState } from 'react';
import { getPromotions } from '../../services/growthApiService';
import { 
  Loader2, 
  Gift, 
  AlertCircle, 
  Coins, 
  Sparkles, 
  Banknote, 
  ExternalLink,
  CheckCircle2,
  Clock,
  Edit3
} from 'lucide-react';
import { AdminRewardModal } from '../../components/growth/AdminRewardModal';

export const Rewards: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabFilter, setTabFilter] = useState<'pending_reward' | 'claimable' | 'claimed' | 'all'>('pending_reward');

  // Modal State
  const [selectedPromo, setSelectedPromo] = useState<any | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState<boolean>(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getPromotions();
      // Only approved submissions are eligible for reward management
      setPromotions(data.filter((p: any) => p.status === 'approved'));
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const openRewardModal = (promo: any, readOnly: boolean = false) => {
    setSelectedPromo(promo);
    setModalReadOnly(readOnly);
  };

  const filteredPromotions = promotions.filter(promo => {
    const pkg = promo.rewardPackage || promo.rewardedItems;
    const rewardStatus = promo.rewardStatus || (pkg ? 'claimed' : 'none');

    if (tabFilter === 'pending_reward') {
      return rewardStatus === 'none' || (!pkg && rewardStatus !== 'claimed');
    }
    if (tabFilter === 'claimable') {
      return rewardStatus === 'claimable';
    }
    if (tabFilter === 'claimed') {
      return rewardStatus === 'claimed';
    }
    return true;
  });

  const pendingRewardCount = promotions.filter(p => {
    const pkg = p.rewardPackage || p.rewardedItems;
    const status = p.rewardStatus || (pkg ? 'claimed' : 'none');
    return status === 'none' || (!pkg && status !== 'claimed');
  }).length;

  const claimableCount = promotions.filter(p => p.rewardStatus === 'claimable').length;
  const claimedCount = promotions.filter(p => {
    const pkg = p.rewardPackage || p.rewardedItems;
    return p.rewardStatus === 'claimed' || (pkg && !p.rewardStatus);
  }).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gift & Reward Management</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Issue custom reward packages (Coins, Catalog Cosmetics, Cash) to approved creators.</p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setTabFilter('pending_reward')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tabFilter === 'pending_reward'
                ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Awaiting Reward ({pendingRewardCount})
          </button>
          <button
            onClick={() => setTabFilter('claimable')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tabFilter === 'claimable'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Claimable ({claimableCount})
          </button>
          <button
            onClick={() => setTabFilter('claimed')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tabFilter === 'claimed'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Claimed ({claimedCount})
          </button>
          <button
            onClick={() => setTabFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tabFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Approved ({promotions.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPromotions.map((promo) => {
            const rewardPackage = promo.rewardPackage || promo.rewardedItems;
            const rewardStatus = promo.rewardStatus || (rewardPackage ? 'claimed' : 'none');
            const coins = Number(rewardPackage?.coins) || 0;
            const cosmeticIds: string[] = Array.isArray(rewardPackage?.cosmeticIds) ? rewardPackage.cosmeticIds : [];
            const cashAmount = Number(rewardPackage?.cashAmount) || 0;

            return (
              <div 
                key={promo.id} 
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between shadow-2xs"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-md ${
                      rewardStatus === 'claimed' ? 'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300' :
                      rewardStatus === 'claimable' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 animate-pulse' :
                      'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}>
                      {rewardStatus === 'claimed' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Claimed by Creator</span>
                        </>
                      ) : rewardStatus === 'claimable' ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Claimable (Pending Creator Claim)</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Awaiting Reward Assignment</span>
                        </>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">
                      Approved: {new Date(promo.reviewedAt || promo.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Creator:</span>
                      <code className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-700 dark:text-slate-300">
                        {promo.userId}
                      </code>
                      <span className="text-slate-400 text-xs">• Platform:</span>
                      <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400">{promo.platform}</span>
                    </h3>
                    <a 
                      href={promo.videoUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-medium hover:underline mt-1 break-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>{promo.videoUrl}</span>
                    </a>
                  </div>

                  {/* Summary of assigned package if any */}
                  {rewardPackage && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {coins > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300">
                          <Coins className="w-3 h-3" /> +{coins.toLocaleString()} Coins
                        </span>
                      )}
                      {cosmeticIds.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-300">
                          <Sparkles className="w-3 h-3" /> {cosmeticIds.length} Cosmetic(s)
                        </span>
                      )}
                      {cashAmount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300">
                          <Banknote className="w-3 h-3" /> ₹{cashAmount.toLocaleString()} INR
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="shrink-0 w-full md:w-auto">
                  {rewardStatus === 'none' && (
                    <button 
                      onClick={() => openRewardModal(promo, false)}
                      className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                    >
                      <Gift className="w-4 h-4" />
                      <span>Configure & Issue Reward</span>
                    </button>
                  )}

                  {rewardStatus === 'claimable' && (
                    <button 
                      onClick={() => openRewardModal(promo, false)}
                      className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>Edit Package</span>
                    </button>
                  )}

                  {rewardStatus === 'claimed' && (
                    <button 
                      onClick={() => openRewardModal(promo, true)}
                      className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>View Claimed Details</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          {filteredPromotions.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No promotions found for the selected filter.
            </div>
          )}
        </div>
      )}

      {/* Admin Reward Modal */}
      {selectedPromo && (
        <AdminRewardModal
          isOpen={true}
          promotion={selectedPromo}
          readOnly={modalReadOnly}
          onClose={() => setSelectedPromo(null)}
          onSuccess={() => {
            load();
            setSelectedPromo(null);
          }}
        />
      )}
    </div>
  );
};
