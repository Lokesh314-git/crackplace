import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { FaAward, FaCoins, FaCircleCheck } from 'react-icons/fa6';
import { Card, Badge, Button } from './ui';

interface Mission {
  id: string;
  title: string;
  actionKey: string;
  target: number;
  current: number;
  xpReward: number;
  coinReward: number;
  completed: boolean;
  claimed: boolean;
}

export const MissionsDeck: React.FC = () => {
  const { userProfile, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  if (!userProfile || !userProfile.missionsState) return null;

  const missionsState = userProfile.missionsState;
  const list: Mission[] = activeTab === 'daily'
    ? missionsState.dailyMissions || []
    : activeTab === 'weekly'
    ? missionsState.weeklyMissions || []
    : missionsState.monthlyMissions || [];

  const handleClaimReward = async (missionId: string) => {
    setClaimingId(missionId);
    try {
      const res = await fetch('/api/auth/missions/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ missionId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to claim reward');
      }
      await res.json();
      // Relying on onSnapshot for state sync
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <Card
      header={
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Placement Preparation Milestones
            </span>
          </div>
          
          {/* Clean Segmented Tab Control */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['daily', 'weekly', 'monthly'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer capitalize ${
                  activeTab === tab
                    ? 'bg-white text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {list.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No active targets for this interval.</p>
        ) : (
          list.map((m: Mission) => {
            const progressPercent = Math.min((m.current / m.target) * 100, 100);
            return (
              <div
                key={m.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  m.claimed
                    ? 'border-slate-200 bg-slate-50/50 opacity-60'
                    : m.completed
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex justify-between items-center gap-4 mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">
                      {m.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Progress: {m.current} / {m.target} ({Math.round(progressPercent)}%)
                    </p>
                  </div>

                  {m.claimed ? (
                    <Badge variant="neutral" size="sm">
                      <FaCircleCheck className="w-3 h-3 text-slate-500" />
                      <span>Completed</span>
                    </Badge>
                  ) : m.completed ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleClaimReward(m.id)}
                      isLoading={claimingId === m.id}
                      className="!bg-emerald-600 hover:!bg-emerald-700 !text-white text-xs h-7 px-3"
                    >
                      Claim Reward
                    </Button>
                  ) : (
                    <Badge variant="primary" size="sm">
                      In Progress
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        m.completed ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Rewards:</span>
                    <div className="flex items-center gap-3 font-semibold">
                      <span className="flex items-center gap-1 text-purple-700">
                        <FaAward className="w-3 h-3 text-purple-600" />
                        <span>+{m.xpReward} XP</span>
                      </span>
                      <span className="flex items-center gap-1 text-amber-700">
                        <FaCoins className="w-3 h-3 text-amber-500" />
                        <span>+{m.coinReward} Coins</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};

export default MissionsDeck;
