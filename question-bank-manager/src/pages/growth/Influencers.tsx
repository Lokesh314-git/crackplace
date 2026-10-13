import React, { useEffect, useState } from 'react';
import { getPromotions, reviewPromotion } from '../../services/growthApiService';
import { 
  Loader2, 
  Video, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Gift, 
  Coins, 
  ExternalLink,
  Sparkles,
  Banknote,
  Clock,
  CheckCircle2,
  Edit3
} from 'lucide-react';
import { AdminRewardModal } from '../../components/growth/AdminRewardModal';
import { COSMETICS_CATALOG } from '../../../../frontend/src/config/cosmetics';

export const Influencers: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Reward Modal State
  const [selectedPromoForReward, setSelectedPromoForReward] = useState<any | null>(null);
  const [modalReadOnly, setModalReadOnly] = useState<boolean>(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getPromotions();
      setPromotions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }

  const handleQuickReject = async (id: string) => {
    const message = prompt('Enter rejection reason or feedback for the creator:');
    if (message === null) return;

    setActionLoading(id);
    try {
      await reviewPromotion(id, { status: 'rejected', message: message.trim() });
      await load();
    } catch (err: any) {
      alert(err.message || 'Failed to reject promotion');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenRewardModal = (promo: any, readOnly: boolean = false) => {
    setSelectedPromoForReward(promo);
    setModalReadOnly(readOnly);
  };

  const filteredPromotions = promotions.filter(p => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const pendingCount = promotions.filter(p => p.status === 'pending').length;
  const approvedCount = promotions.filter(p => p.status === 'approved').length;
  const rejectedCount = promotions.filter(p => p.status === 'rejected').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Influencer Submissions</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Review creator videos and assign claimable reward packages.</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'all' 
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({promotions.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'pending' 
                ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-2xs font-bold' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'approved' 
                ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-2xs font-bold' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'rejected' 
                ? 'bg-white dark:bg-slate-900 text-red-600 shadow-2xs' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
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
            const hasReward = coins > 0 || cosmeticIds.length > 0 || cashAmount > 0;

            return (
              <div 
                key={promo.id} 
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col lg:flex-row gap-5 justify-between items-start lg:items-center shadow-2xs"
              >
                <div className="flex-1 space-y-3 min-w-0">
                  {/* Top Status & Date */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md uppercase tracking-wider ${
                      promo.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' :
                      promo.status === 'rejected' ? 'bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300' :
                      'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}>
                      {promo.status}
                    </span>

                    {/* Reward Status Chip */}
                    {promo.status === 'approved' && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold rounded-md ${
                        rewardStatus === 'claimed' ? 'bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300' :
                        rewardStatus === 'claimable' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 animate-pulse' :
                        'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400'
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
                            <span>No Reward Package</span>
                          </>
                        )}
                      </span>
                    )}

                    <span className="text-xs text-slate-400 ml-auto">
                      Submitted: {new Date(promo.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Submission Info */}
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1 flex items-center gap-2">
                      <span>User ID:</span>
                      <code className="text-xs px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-700 dark:text-slate-300">
                        {promo.userId}
                      </code>
                      <span className="text-slate-400 text-xs">• Platform:</span>
                      <span className="text-xs uppercase font-bold text-indigo-600 dark:text-indigo-400">
                        {promo.platform}
                      </span>
                    </h3>
                    
                    <a 
                      href={promo.videoUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:underline break-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span>{promo.videoUrl}</span>
                    </a>
                  </div>

                  {/* Reward Package Summary Chips */}
                  {promo.status === 'approved' && hasReward && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Assigned Package:</span>
                        {coins > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold">
                            <Coins className="w-3 h-3" /> +{coins.toLocaleString()} Coins
                          </span>
                        )}
                        {cosmeticIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 text-xs font-bold">
                            <Sparkles className="w-3 h-3" /> {cosmeticIds.length} Cosmetic(s)
                          </span>
                        )}
                        {cashAmount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                            <Banknote className="w-3 h-3" /> ₹{cashAmount.toLocaleString()} INR
                          </span>
                        )}
                      </div>
                      
                      {cosmeticIds.length > 0 && (
                        <div className="text-[11px] text-slate-500 truncate">
                          Items: {cosmeticIds.map(id => COSMETICS_CATALOG.find(c => c.id === id)?.name || id).join(', ')}
                        </div>
                      )}

                      {rewardPackage?.message && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 italic">
                          "{rewardPackage.message}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Feedback Message if any */}
                  {promo.adminMessage && !rewardPackage?.message && (
                    <div className="text-xs bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                      <strong>Admin Feedback:</strong> {promo.adminMessage}
                    </div>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-48 justify-end">
                  {promo.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleOpenRewardModal(promo, false)}
                        disabled={actionLoading === promo.id}
                        className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        <Gift className="w-4 h-4" />
                        <span>Approve & Reward</span>
                      </button>

                      <button 
                        onClick={() => handleQuickReject(promo.id)}
                        disabled={actionLoading === promo.id}
                        className="flex-1 lg:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        {actionLoading === promo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {promo.status === 'approved' && (
                    <>
                      {rewardStatus === 'none' && (
                        <button 
                          onClick={() => handleOpenRewardModal(promo, false)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                        >
                          <Gift className="w-4 h-4" />
                          <span>Assign Reward</span>
                        </button>
                      )}

                      {rewardStatus === 'claimable' && (
                        <button 
                          onClick={() => handleOpenRewardModal(promo, false)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Package</span>
                        </button>
                      )}

                      {rewardStatus === 'claimed' && (
                        <button 
                          onClick={() => handleOpenRewardModal(promo, true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>View Claimed</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          
          {filteredPromotions.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No influencer submissions found for the selected filter.
            </div>
          )}
        </div>
      )}

      {/* Admin Reward Modal */}
      {selectedPromoForReward && (
        <AdminRewardModal 
          isOpen={true}
          promotion={selectedPromoForReward}
          readOnly={modalReadOnly}
          onClose={() => setSelectedPromoForReward(null)}
          onSuccess={() => {
            load();
            setSelectedPromoForReward(null);
          }}
        />
      )}
    </div>
  );
};
