import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaUserPlus, FaVideo, FaCheck, FaClock, FaGift } from 'react-icons/fa6';
import { PromotionRewardModal } from '../components/PromotionRewardModal';

export const InvitePromote: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'invite' | 'promote'>('invite');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cashRewards, setCashRewards] = useState<any[]>([]);
  
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState('youtube');
  const [submitting, setSubmitting] = useState(false);
  const [selectedPromoModal, setSelectedPromoModal] = useState<any | null>(null);
  
  // Dummy data loading for now to test frontend structure
  useEffect(() => {
    fetchReferrals();
    fetchPromotions();
    fetchCashRewards();
  }, []);

  const fetchReferrals = async () => {
    try {
      const response = await fetch('/api/invite-promote/referrals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReferrals(data.referrals || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPromotions = async () => {
    try {
      const response = await fetch('/api/invite-promote/promotions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const updatedList = data.promotions || [];
        setPromotions(updatedList);
        setSelectedPromoModal((prev: any) => {
          if (!prev) return null;
          const fresh = updatedList.find((p: any) => p.id === prev.id);
          return fresh || prev;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCashRewards = async () => {
    try {
      const response = await fetch('/api/invite-promote/cash-rewards', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCashRewards(data.cashRewards || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromotionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/invite-promote/promotions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ videoUrl, platform })
      });
      if (response.ok) {
        setVideoUrl('');
        fetchPromotions();
      } else {
        alert('Failed to submit promotion');
      }
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/register?ref=${userProfile?.uid}`;
    navigator.clipboard.writeText(link);
    alert('Copied referral link!');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Invite & Promote</h1>
          <p className="text-blue-100 max-w-2xl text-sm">
            Earn legendary cosmetics, coins, and exclusive cash rewards by inviting your friends or creating content about CrackPlace AI.
          </p>
        </div>
        
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('invite')}
            className={`flex-1 py-4 text-center font-semibold text-sm transition-colors ${
              activeTab === 'invite' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FaUserPlus /> Invite Friends
            </div>
          </button>
          <button
            onClick={() => setActiveTab('promote')}
            className={`flex-1 py-4 text-center font-semibold text-sm transition-colors ${
              activeTab === 'promote' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FaVideo /> Promote CrackPlace
            </div>
          </button>
        </div>

        <div className="p-6 md:p-8">
          {activeTab === 'invite' && (() => {
            const totalInvited = referrals.length;
            const successfulReferrals = referrals.filter(r => r.status === 'rewarded').length;
            const totalCoinsEarned = referrals
              .filter(r => r.status === 'rewarded' && r.rewardDetails?.coins)
              .reduce((sum, r) => sum + r.rewardDetails.coins, 0);

            return (
              <div className="space-y-8">
                {/* Reward Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">Friends Invited</div>
                    <div className="text-2xl font-bold text-slate-800">{totalInvited}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <div className="text-xs font-bold text-emerald-600 uppercase mb-1">Successful Referrals</div>
                    <div className="text-2xl font-bold text-emerald-700">{successfulReferrals}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <div className="text-xs font-bold text-amber-600 uppercase mb-1">Rewards Earned</div>
                    <div className="text-2xl font-bold text-amber-700 flex items-center justify-center gap-1">
                      <FaGift className="w-4 h-4" /> {totalCoinsEarned}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                  <h3 className="font-bold text-slate-800 mb-2">Your Referral Link</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Share this link with your friends. You will earn rewards once they register AND complete their first qualifying activity (Practice Hub or Battle Arena).
                  </p>
                  <div className="flex items-center justify-center gap-2 max-w-xl mx-auto">
                    <div className="bg-white border border-slate-300 rounded-lg px-4 py-3 font-mono text-xs flex-1 truncate text-left text-slate-600 select-all">
                      {window.location.origin}/register?ref={userProfile?.uid}
                    </div>
                    <button onClick={copyReferralLink} className="bg-blue-600 text-white font-bold text-xs px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                      Copy Link
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FaCheck className="text-emerald-500" /> Invite History
                  </h3>
                  {referrals.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-100">
                      You haven't referred anyone yet. Share your link to get started!
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Friend</th>
                            <th className="px-4 py-3">Joined</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Reward</th>
                            <th className="px-4 py-3">Reward Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {referrals.map((ref) => (
                            <tr key={ref.id} className="bg-white">
                              <td className="px-4 py-3 font-medium text-slate-900">{ref.referredDisplayName || 'Anonymous User'}</td>
                              <td className="px-4 py-3 text-xs">{new Date(ref.createdAt).toLocaleDateString()}</td>
                              <td className="px-4 py-3">
                                {ref.status === 'pending' ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                    <FaClock className="w-3 h-3" /> In Progress
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    <FaCheck className="w-3 h-3" /> Reward Earned
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs font-medium">
                                {ref.status === 'rewarded' && ref.rewardDetails ? (
                                  <span className="text-amber-600">+{ref.rewardDetails.coins} Coins</span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {ref.rewardedAt ? new Date(ref.rewardedAt).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'promote' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-slate-800 mb-2">Submit Your Promotion</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Created a YouTube video, Instagram Reel, or TikTok about CrackPlace? Submit the link here! Our team will review your content and issue exclusive gifts, coins, or cash rewards based on quality and reach.
                  </p>
                  <form onSubmit={handlePromotionSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Platform</label>
                      <select 
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        <option value="youtube">YouTube</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Video URL</label>
                      <input 
                        type="url" 
                        required
                        placeholder="https://..."
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="w-full bg-indigo-600 text-white font-bold text-sm px-4 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? 'Submitting...' : 'Submit Promotion'}
                    </button>
                  </form>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                  <h3 className="font-bold text-slate-800 mb-4">Creator Dashboard</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Your Submissions</h4>
                      {promotions.length === 0 ? (
                        <div className="text-xs text-slate-400">No submissions yet.</div>
                      ) : (
                        <div className="space-y-3">
                          {promotions.map((promo) => {
                            const rewardPackage = promo.rewardPackage || promo.rewardedItems;
                            const rewardStatus = promo.rewardStatus || (rewardPackage ? 'claimed' : 'none');

                            return (
                              <div key={promo.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                                        {promo.platform}
                                      </span>
                                      <span className="text-[11px] text-slate-400">
                                        {new Date(promo.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <a 
                                      href={promo.videoUrl} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium break-all"
                                    >
                                      {promo.videoUrl}
                                    </a>
                                  </div>
                                  
                                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                                    promo.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                    promo.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                    'bg-red-100 text-red-700 border border-red-200'
                                  }`}>
                                    {promo.status}
                                  </span>
                                </div>

                                {promo.adminMessage && (
                                  <div className="text-xs bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-slate-600">
                                    <strong className="text-slate-700">Admin Note:</strong> {promo.adminMessage}
                                  </div>
                                )}

                                {/* Reward Status & Action */}
                                {promo.status === 'approved' && (
                                  <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-xs">
                                      <span className="font-semibold text-slate-700">Reward: </span>
                                      {rewardStatus === 'claimable' && (
                                        <span className="text-emerald-600 font-bold">Ready to claim!</span>
                                      )}
                                      {rewardStatus === 'claimed' && (
                                        <span className="text-slate-500 font-medium">Claimed & Added to account</span>
                                      )}
                                      {rewardStatus === 'none' && (
                                        <span className="text-slate-400">Pending admin assignment</span>
                                      )}
                                    </div>

                                    {rewardStatus === 'claimable' && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPromoModal(promo)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                                      >
                                        <FaGift className="w-3 h-3 animate-bounce" />
                                        <span>Rewards Granted</span>
                                        <span className="bg-white/25 px-1.5 py-0.2 rounded text-[10px] uppercase font-mono font-bold ml-1">
                                          CLAIMABLE
                                        </span>
                                      </button>
                                    )}

                                    {rewardStatus === 'claimed' && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPromoModal(promo)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                                      >
                                        <FaCheck className="w-3 h-3 text-emerald-600" />
                                        <span>Rewards Granted</span>
                                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded text-[10px] uppercase font-mono font-bold ml-1">
                                          CLAIMED
                                        </span>
                                      </button>
                                    )}

                                    {rewardStatus === 'none' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200">
                                        <FaClock className="w-2.5 h-2.5 text-slate-400" />
                                        <span>No Reward Package</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cash Rewards</h4>
                      {cashRewards.length === 0 ? (
                        <div className="text-xs text-slate-400">No cash rewards yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {cashRewards.map((cash) => (
                            <div key={cash.id} className="bg-white border border-slate-200 rounded-lg p-3 flex justify-between items-center">
                              <div>
                                <div className="font-bold text-sm text-slate-800">
                                  {cash.amount} {cash.currency || 'INR'}
                                </div>
                                {cash.fulfillmentReference && (
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    Transaction ID: {cash.fulfillmentReference}
                                  </div>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                cash.status === 'Pending Payment' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                cash.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {cash.status.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Promotion Reward Details & Claim Modal */}
      {selectedPromoModal && (
        <PromotionRewardModal
          isOpen={true}
          promotion={selectedPromoModal}
          cashRewards={cashRewards}
          token={token}
          onClose={() => setSelectedPromoModal(null)}
          onClaimSuccess={() => {
            fetchPromotions();
            fetchCashRewards();
          }}
        />
      )}
    </div>
  );
};

export default InvitePromote;
