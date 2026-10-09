import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export const AdminPanel: React.FC = () => {
  const { userProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'referrals' | 'promotions' | 'cash' | 'questions'>('promotions');
  
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
              {/* Table of referrals would go here */}
              <div className="bg-slate-50 p-8 text-center text-slate-400 rounded-lg border border-slate-200">
                Referral review dashboard loading...
              </div>
            </div>
          )}
          
          {activeTab === 'promotions' && (
            <div>
              <h2 className="text-lg font-bold mb-4">Influencer Promotions Review</h2>
              <p className="text-sm text-slate-500 mb-4">Review submitted videos and grant custom gift packages or log cash payments.</p>
              {/* Table of promotions would go here */}
              <div className="bg-slate-50 p-8 text-center text-slate-400 rounded-lg border border-slate-200">
                Promotions review dashboard loading...
              </div>
            </div>
          )}

          {activeTab === 'cash' && (
            <div>
              <h2 className="text-lg font-bold mb-4">Pending Cash Payments</h2>
              <p className="text-sm text-slate-500 mb-4">Mark pending cash rewards as Paid once actual fulfillment has occurred.</p>
              {/* Table of pending cash payments would go here */}
              <div className="bg-slate-50 p-8 text-center text-slate-400 rounded-lg border border-slate-200">
                Cash fulfillment dashboard loading...
              </div>
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
