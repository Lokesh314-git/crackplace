import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { FaCircleExclamation, FaArrowRight } from 'react-icons/fa6';
import { Card, Button, Badge } from '../components/ui';

interface RoomDetails {
  roomId: string;
  hostName: string;
  hostAvatar: string;
  battleType: string;
  settings: {
    questionsCount: number;
    difficulty: string;
    timeLimit: number;
    category: string;
    company: string;
  };
  status: string;
  expirationTime: string;
}

export const Invite: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { token, authUser, loading: authLoading } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDetails | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!authUser) {
      if (roomId) {
        sessionStorage.setItem('pending_invite', roomId);
      }
      navigate('/login');
      return;
    }

    const fetchRoomInfo = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch(`/api/auth/battle-room/info/${roomId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch invite details');
        }

        setRoom(data.room);
        navigate(`/battle?room=${data.room.roomId}`, { replace: true });
      } catch (err: any) {
        setErrorMsg(err.message || 'Invitation is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      fetchRoomInfo();
    }
  }, [roomId, authUser, authLoading, token, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100">
        <div className="w-8 h-8 border-2 border-primary-600/20 border-t-primary-500 rounded-full animate-spin"></div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-white">
            {authLoading ? 'Verifying authentication...' : 'Connecting to Assessment Lobby...'}
          </p>
          <p className="text-xs text-slate-400">
            Please wait a moment...
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4" data-theme="dark">
        <div className="w-full max-w-md">
          <Card className="p-8 text-center space-y-6">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <FaCircleExclamation className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Room Inaccessible</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => navigate('/')}
              className="w-full justify-center"
            >
              Return to Dashboard
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {room && (
        <div className="w-full max-w-md">
          <Card className="p-8 text-center space-y-6">
            <div className="space-y-3">
              <img
                src={room.hostAvatar}
                alt={room.hostName}
                className="w-16 h-16 rounded-full border border-slate-700 bg-slate-900 object-cover mx-auto"
              />
              <div>
                <Badge variant="accent" size="sm" className="mb-2">
                  Battle Challenge
                </Badge>
                <h2 className="text-lg font-bold text-white">
                  {room.hostName} invited you to a battle
                </h2>
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3 text-left">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Lobby Settings
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Category</span>
                  <span className="font-semibold text-white mt-0.5 block">{room.battleType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Difficulty</span>
                  <span className="font-semibold text-white mt-0.5 block capitalize">{room.settings.difficulty}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Questions</span>
                  <span className="font-semibold text-white mt-0.5 block">{room.settings.questionsCount} Questions</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Timer</span>
                  <span className="font-semibold text-white mt-0.5 block">{room.settings.timeLimit}s / Q</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <Button
                variant="primary"
                onClick={() => navigate(`/battle?room=${room.roomId}`)}
                className="w-full justify-center"
              >
                <span>Accept & Enter Battle</span>
                <FaArrowRight className="w-3 h-3 ml-1.5" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate('/')}
                className="w-full justify-center"
              >
                Decline
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Invite;
