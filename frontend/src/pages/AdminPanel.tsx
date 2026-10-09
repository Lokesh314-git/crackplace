import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export const AdminPanel: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'referrals' | 'promotions' | 'cash' | 'questions'>('cash');
  const [cashRewards, setCashRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [txInputs, setTxInputs] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (activeTab === 'cash' && userProfile?.role === 'admin') {
      fetchCashRewards();
    }
  }, [activeTab, userProfile]);

  const fetchCashRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invite-promote/admin/cash-rewards', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCashRewards(data.cashRewards || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const updateCashStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/invite-promote/admin/cash-rewards/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          reference: txInputs[id] || undefined
        })
      });
      if (res.ok) {
        fetchCashRewards();
      } else {
        alert('Failed to update');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (userProfile?.role !== 'admin') {
    return <div className="p-6 text-red-500 font-bold">Unauthorized</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Admin Portal</h1>
          <p className="text-slate-400 text-sm">
            Manage referrals, influencer promotions, cash payments, and question banks.
          </p>
        </div>
        
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {['referrals', 'promotions', 'cash', 'questions'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 min-w-[150px] py-4 text-center font-semibold text-sm transition-colors uppercase tracking-wider ${
                activeTab === tab 
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50' 
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'referrals' && (
            <div>
              <h2 className="text-lg font-bold mb-4">Referral Management</h2>
              <p className="text-sm text-slate-500 mb-4">View and audit all referrals, their qualification status, and trigger rewards manually if needed.</p>
              <div className="bg-slate-50 p-8 text-center text-slate-400 rounded-lg border border-slate-200">
                Referral review dashboard loading...
              </div>
            </div>
          )}
          
          {activeTab === 'promotions' && (
            <div>
              <h2 className="text-lg font-bold mb-4">Influencer Promotions Review</h2>
              <p className="text-sm text-slate-500 mb-4">Review submitted videos and grant custom gift packages or log cash payments.</p>
              <div className="bg-slate-50 p-8 text-center text-slate-400 rounded-lg border border-slate-200">
                Promotions review dashboard loading...
              </div>
            </div>
          )}

          {activeTab === 'cash' && (
            <div>
              <h2 className="text-lg font-bold mb-4">Pending Cash Payments</h2>
              <p className="text-sm text-slate-500 mb-4">Mark pending cash rewards as Paid once actual fulfillment has occurred.</p>
              {loading ? (
                <div className="text-slate-400">Loading...</div>
              ) : cashRewards.length === 0 ? (
                <div className="bg-slate-50 p-8 text-center text-slate-400 rounded-lg border border-slate-200">
                  No cash rewards found.
                </div>
              ) : (
                <div className="space-y-4">
                  {cashRewards.map((cash) => (
                    <div key={cash.id} className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 text-lg">
                          {cash.amount} INR
                        </div>
                        <div className="text-xs text-slate-500">
                          User ID: {cash.userId} | Promotion ID: {cash.promotionId}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Status: <span className="font-semibold text-slate-700">{cash.status}</span>
                        </div>
                        {cash.fulfillmentReference && (
                          <div className="text-sm font-semibold text-indigo-600 mt-1">
                            Transaction ID: {cash.fulfillmentReference}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {cash.status !== 'Paid' && (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Enter Transaction ID"
                              className="border border-slate-300 rounded px-2 py-1 text-sm"
                              value={txInputs[cash.id] || ''}
                              onChange={(e) => setTxInputs({ ...txInputs, [cash.id]: e.target.value })}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateCashStatus(cash.id, 'Paid')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-bold"
                              >
                                Mark Paid
                              </button>
                              <button
                                onClick={() => updateCashStatus(cash.id, 'Rejected')}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'questions' && (
            <div>
              <h2 className="text-lg font-bold mb-4">Question Management</h2>
              <p className="text-sm text-slate-500 mb-4">Manage the question bank (Existing feature placeholder).</p>
              <div className="bg-slate-50 p-8 text-center text-slate-400 rounded-lg border border-slate-200">
                Question Management Portal UI...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
