import React, { useEffect, useState } from 'react';
import { getPromotions, reviewPromotion } from '../../services/growthApiService';
import { Loader2, Video, AlertCircle, CheckCircle, XCircle, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Influencers: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getPromotions();
      setPromotions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const handleReview = async (id: string, status: 'approved' | 'rejected') => {
    const message = prompt(`Enter ${status === 'approved' ? 'approval' : 'rejection'} message for the creator:`);
    if (message === null) return;

    setActionLoading(id);
    try {
      await reviewPromotion(id, { status, message });
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
          <Video className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Influencer Submissions</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Review video submissions from influencers.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      ) : (
        <div className="grid gap-4">
          {promotions.map((promo) => (
            <div key={promo.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 text-xs font-bold rounded ${
                    promo.status === 'approved' ? 'bg-green-100 text-green-700' :
                    promo.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {promo.status.toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-500">{new Date(promo.createdAt).toLocaleString()}</span>
                </div>
                <h3 className="font-semibold mb-1">User ID: {promo.userId}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Platform: <span className="capitalize font-medium">{promo.platform}</span></p>
                <a href={promo.videoUrl} target="_blank" rel="noreferrer" className="text-emerald-600 text-sm font-medium hover:underline break-all">
                  {promo.videoUrl}
                </a>
                
                {promo.adminMessage && (
                  <div className="mt-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-sm border border-slate-100 dark:border-slate-700">
                    <strong className="text-slate-700 dark:text-slate-300 block mb-1">Admin Feedback:</strong>
                    <span className="text-slate-600 dark:text-slate-400">{promo.adminMessage}</span>
                  </div>
                )}
                
                {promo.status === 'approved' && (
                  <div className="mt-3 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg text-sm border border-indigo-100 dark:border-indigo-800/30">
                    <strong className="text-indigo-800 dark:text-indigo-300 block mb-1">Reward Status:</strong>
                    {promo.rewardedItems ? (
                       <span className="text-indigo-600 dark:text-indigo-400 font-medium">Reward Issued</span>
                    ) : (
                       <span className="text-amber-600 dark:text-amber-400 font-medium">Pending Reward</span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-row md:flex-col gap-2 justify-center">
                {promo.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleReview(promo.id, 'approved')}
                      disabled={actionLoading === promo.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {actionLoading === promo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button 
                      onClick={() => handleReview(promo.id, 'rejected')}
                      disabled={actionLoading === promo.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      {actionLoading === promo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </>
                )}
                {promo.status === 'approved' && !promo.rewardedItems && (
                  <button 
                    onClick={() => navigate('/growth/rewards')}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Gift className="w-4 h-4" />
                    Issue Reward
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {promotions.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No influencer submissions found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
