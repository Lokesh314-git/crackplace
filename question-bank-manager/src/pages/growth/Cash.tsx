import React, { useEffect, useState } from 'react';
import { getCashRewards, updateCashRewardStatus } from '../../services/growthApiService';
import { Loader2, Banknote, AlertCircle, CheckCircle } from 'lucide-react';

export const Cash: React.FC = () => {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getCashRewards();
      setRewards(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    const paymentRef = prompt('Enter payment reference or transaction ID (evidence of payment):');
    if (paymentRef === null) return;
    if (paymentRef.trim() === '') {
      alert('Payment reference is required to mark as paid.');
      return;
    }

    if (!confirm('Are you absolutely sure this payment has been completed? This cannot be undone.')) return;

    setActionLoading(id);
    try {
      await updateCashRewardStatus(id, 'paid', paymentRef);
      alert('Payment marked as paid successfully!');
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
          <Banknote className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pending Cash Payments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage and fulfill real cash rewards.</p>
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Creator ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Authorized Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Payment Ref</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rewards.map((reward, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 text-sm font-medium">{reward.userId}</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600">
                    {reward.amount} {reward.currency || 'INR'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      reward.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {reward.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{new Date(reward.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{reward.fulfillmentReference || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {reward.status === 'pending' && (
                      <button 
                        onClick={() => handleMarkAsPaid(reward.id)}
                        disabled={actionLoading === reward.id}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                      >
                        {actionLoading === reward.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Mark as Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rewards.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No cash rewards found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
