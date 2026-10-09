import React, { useEffect, useState } from 'react';
import { getPromotions, reviewPromotion } from '../../services/growthApiService';
import { Loader2, Gift, AlertCircle } from 'lucide-react';

export const Rewards: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getPromotions();
      // Only show approved promotions that haven't been rewarded yet
      setPromotions(data.filter((p: any) => p.status === 'approved' && !p.rewardedItems));
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const handleGrantReward = async (id: string) => {
    const coinsInput = prompt('Enter coins amount to grant:', '5000');
    if (coinsInput === null) return;
    
    const coins = parseInt(coinsInput, 10);
    if (isNaN(coins) || coins < 0) {
      alert('Invalid coins amount');
      return;
    }

    const message = prompt('Enter a personalized reward message:', 'Thank you for promoting CrackPlace! We appreciate your effort in introducing our platform to your audience. Enjoy your reward!');
    if (message === null) return;

    setActionLoading(id);
    try {
      // Re-review with same 'approved' status but now granting reward details
      await reviewPromotion(id, {
        status: 'approved',
        message,
        rewardDetails: { coins }
      });
      alert('Reward granted successfully!');
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
          <Gift className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gift & Reward Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Grant coins and cosmetics to approved influencers.</p>
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
            <div key={promo.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-5 items-center justify-between">
              <div>
                <h3 className="font-semibold mb-1">User ID: {promo.userId}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Platform: <span className="capitalize">{promo.platform}</span></p>
                <a href={promo.videoUrl} target="_blank" rel="noreferrer" className="text-emerald-600 text-sm font-medium hover:underline">
                  View Video
                </a>
              </div>
              
              <button 
                onClick={() => handleGrantReward(promo.id)}
                disabled={actionLoading === promo.id}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                {actionLoading === promo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                Grant Reward Package
              </button>
            </div>
          ))}
          
          {promotions.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500">
              No approved submissions awaiting rewards.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
