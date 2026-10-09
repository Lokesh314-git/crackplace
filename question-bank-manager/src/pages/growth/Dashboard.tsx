import React, { useEffect, useState } from 'react';
import { getGrowthDashboardStats } from '../../services/growthApiService';
import { Loader2, TrendingUp, Users, Video, DollarSign, Gift, Activity } from 'lucide-react';

export const GrowthDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getGrowthDashboardStats();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
          {error}
        </div>
      </div>
    );
  }

  const cards = [
    { label: 'Total Referrals', value: stats.totalReferrals, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Completed Referrals', value: stats.completedReferrals, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Pending Referrals', value: stats.pendingReferrals, icon: Activity, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Total Promotions', value: stats.totalPromotions, icon: Video, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Pending Promotions', value: stats.pendingPromotions, icon: Video, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'Coins Issued', value: stats.totalCoinsIssued.toLocaleString(), icon: DollarSign, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { label: 'Completed Cash Payments', value: stats.completedCashPayments, icon: Gift, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Pending Cash Payments', value: stats.pendingCashPayments, icon: DollarSign, color: 'text-red-500', bg: 'bg-red-50' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Growth Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Overview of referrals, influencer campaigns, and rewards.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex items-start gap-4">
              <div className={`p-3 rounded-xl ${card.bg} ${card.color} dark:bg-opacity-10`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
