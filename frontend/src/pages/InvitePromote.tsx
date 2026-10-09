import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaUserPlus, FaVideo, FaCheck, FaClock, FaGift } from 'react-icons/fa6';

export const InvitePromote: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'invite' | 'promote'>('invite');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cashRewards, setCashRewards] = useState<any[]>([]);
  
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState('youtube');
  const [submitting, setSubmitting] = useState(false);
  
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
        setPromotions(data.promotions || []);
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
          {activeTab === 'invite' && (
            <div className="space-y-8">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                <h3 className="font-bold text-slate-800 mb-2">Your Referral Link</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Share this link with your friends. You will earn rewards once they register AND complete their first qualifying activity.
                </p>
                <div className="flex items-center justify-center gap-2 max-w-xl mx-auto">
                  <div className="bg-white border border-slate-300 rounded-lg px-4 py-3 font-mono text-xs flex-1 truncate text-left text-slate-600">
                    {window.location.origin}/register?ref={userProfile?.uid}
                  </div>
                  <button onClick={copyReferralLink} className="bg-blue-600 text-white font-bold text-xs px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                    Copy Link
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FaCheck className="text-emerald-500" /> Your Referrals
                </h3>
                {referrals.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-100">
                    You haven't referred anyone yet. Share your link to get started!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {referrals.map((ref) => (
                      <div key={ref.id} className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl">
                        <div>
                          <div className="font-bold text-sm">{ref.referredDisplayName || 'Anonymous User'}</div>
                          <div className="text-xs text-slate-500">Registered: {new Date(ref.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div>
                          {ref.status === 'pending' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                              <FaClock className="w-3 h-3" /> Activity Required
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <FaCheck className="w-3 h-3" /> Rewarded
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

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
                        <div className="space-y-2">
                          {promotions.map((promo) => (
                            <div key={promo.id} className="bg-white border border-slate-200 rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <a href={promo.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[200px]">
                                  {promo.videoUrl}
                                </a>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  promo.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                  promo.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {promo.status.toUpperCase()}
                                </span>
                              </div>
                              {promo.adminMessage && (
                                <div className="text-xs bg-slate-50 border border-slate-100 p-2 rounded text-slate-600 mt-2">
                                  <strong>Admin:</strong> {promo.adminMessage}
                                </div>
                              )}
                              {promo.rewardedItems && (
                                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
                                  <FaGift /> Rewards Granted
                                </div>
                              )}
                            </div>
                          ))}
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
                              <div className="font-bold text-sm text-slate-800">
                                {cash.amount} {cash.currency}
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
    </div>
  );
};

export default InvitePromote;
