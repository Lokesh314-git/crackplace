import React, { useEffect, useState } from 'react';
import { getPromotions, reviewPromotion } from '../../services/growthApiService';
import { Loader2, Gift, AlertCircle } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
// Import cosmetics catalog from frontend to ensure valid IDs
import { COSMETICS_CATALOG } from '../../../../frontend/src/config/cosmetics';

export const Rewards: React.FC = () => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal State
  const [selectedPromo, setSelectedPromo] = useState<any>(null);
  const [coins, setCoins] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [selectedCosmetics, setSelectedCosmetics] = useState<string[]>([]);
  const [adminMessage, setAdminMessage] = useState('Thank you for promoting CrackPlace! We appreciate your effort in introducing our platform to your audience. Enjoy your reward!');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getPromotions();
      // Show approved promotions that haven't been rewarded yet, or you could show all to allow history tracking
      setPromotions(data.filter((p: any) => p.status === 'approved' && !p.rewardedItems));
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const openRewardModal = (promo: any) => {
    setSelectedPromo(promo);
    setCoins(5000);
    setCashAmount(0);
    setSelectedCosmetics([]);
    setAdminMessage('Thank you for promoting CrackPlace! Enjoy your reward!');
  };

  const toggleCosmetic = (id: string) => {
    setSelectedCosmetics(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleGrantReward = async () => {
    if (!selectedPromo) return;
    setActionLoading(selectedPromo.id);
    
    try {
      await reviewPromotion(selectedPromo.id, {
        status: 'approved',
        message: adminMessage,
        rewardDetails: { 
          coins,
          cashAmount,
          currency: 'USD',
          cosmeticIds: selectedCosmetics
        }
      });
      alert('Reward granted successfully!');
      setSelectedPromo(null);
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
          <p className="text-sm text-slate-500 dark:text-slate-400">Issue custom reward packages (Coins, Cosmetics, Cash) to approved influencers.</p>
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
                onClick={() => openRewardModal(promo)}
                disabled={actionLoading === promo.id}
                className="flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                {actionLoading === promo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                Issue Reward
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

      {selectedPromo && (
        <Modal 
          isOpen={true} 
          onClose={() => setSelectedPromo(null)}
          title="Configure Reward Package"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <label className="block text-sm font-medium mb-1">Coins to Grant</label>
              <input 
                type="number" 
                value={coins} 
                onChange={e => setCoins(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Cash Amount (USD)</label>
              <input 
                type="number" 
                value={cashAmount} 
                onChange={e => setCashAmount(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-slate-500 mt-1">If set &gt; 0, this will create a pending payment in the Cash tab.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Cosmetics</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto border p-2 rounded-lg bg-slate-50">
                {COSMETICS_CATALOG.filter(c => !c.isFree).map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm p-1 hover:bg-slate-100 rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={selectedCosmetics.includes(c.id)}
                      onChange={() => toggleCosmetic(c.id)}
                    />
                    <span>{c.name} <span className="text-xs text-slate-400">({c.rarity})</span></span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Personalized Message</label>
              <textarea 
                value={adminMessage} 
                onChange={e => setAdminMessage(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg h-24"
              />
            </div>

            <button 
              onClick={handleGrantReward}
              disabled={actionLoading === selectedPromo.id}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              {actionLoading === selectedPromo.id ? 'Granting...' : 'Confirm & Grant Reward'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
